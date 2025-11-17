import { useEffect, useMemo, useRef, useState } from 'react';
import { createLocalTracks, LocalAudioTrack, LocalTrack, LocalVideoTrack, Room, RoomEvent, Track } from 'livekit-client';
import { isTrackReference, TrackReference, useTracks, VideoTrack } from '@livekit/components-react';
import { Video, Mic, Users } from 'lucide-react';
import { useMediaModuleContext } from '../context/MediaModuleContext';

type LocalMediaRefs = {
	videoTrack: LocalVideoTrack | null;
	audioTrack: LocalAudioTrack | null;
};

const publishLocalTracks = async (
	room: Room,
	refs: LocalMediaRefs,
	published: { video: boolean; audio: boolean },
) => {
	if (!refs.videoTrack && !refs.audioTrack) {
		return;
	}

	const publish = (track: LocalTrack | null, name: string, kind: 'video' | 'audio') => {
		if (!track) {
			return;
		}
		if (published[kind]) {
			return;
		}
		room.localParticipant.publishTrack(track, { name }).then(() => {
			published[kind] = true;
		}).catch((error) => {
			console.error(`Failed to publish ${name} track`, error);
		});
	};

	publish(refs.videoTrack, 'mission-control-webcam', 'video');
	publish(refs.audioTrack, 'mission-control-mic', 'audio');
};

export const WebCam: React.FC = () => {
	const { room, webcamControls, module: mediaModule } = useMediaModuleContext();

	// Early guard: until a Room instance exists, show lightweight placeholder.
	if (!room) {
		return (
			<div className="w-56 space-y-3 text-xs text-slate-400">
				Realtime session initializing…
			</div>
		);
	}

	const [fallbackWebcamEnabled, setFallbackWebcamEnabled] = useState(false);
	const [fallbackMicMuted, setFallbackMicMuted] = useState(false);
	const [fallbackShowRemote, setFallbackShowRemote] = useState(true);

	const webcamEnabled = webcamControls?.webcamEnabled ?? fallbackWebcamEnabled;
	const setWebcamEnabled = webcamControls?.setWebcamEnabled ?? setFallbackWebcamEnabled;
	const micMuted = webcamControls?.micMuted ?? fallbackMicMuted;
	const setMicMuted = webcamControls?.setMicMuted ?? setFallbackMicMuted;
	const showRemote = webcamControls?.showRemote ?? fallbackShowRemote;
	const setShowRemote = webcamControls?.setShowRemote ?? setFallbackShowRemote;

	const controlsForContext = useMemo(
		() => ({
			webcamEnabled,
			setWebcamEnabled,
			micMuted,
			setMicMuted,
			showRemote,
			setShowRemote,
		}),
		[webcamEnabled, setWebcamEnabled, micMuted, setMicMuted, showRemote, setShowRemote],
	);

	useEffect(() => {
		mediaModule.setWebcamControls(controlsForContext);
	}, [mediaModule, controlsForContext]);

	useEffect(() => () => {
		mediaModule.setWebcamControls(undefined);
	}, [mediaModule]);

	const localVideoRef = useRef<HTMLVideoElement | null>(null);
	const localTracksRef = useRef<LocalMediaRefs>({ videoTrack: null, audioTrack: null });
	const publishedRef = useRef({ video: false, audio: false });

	const remoteCameraTracks = useTracks(
		[{ source: Track.Source.Camera, withPlaceholder: false }],
		{ onlySubscribed: false },
	);

	const remoteVideoTrackRef = useMemo<TrackReference | undefined>(() => {
		return remoteCameraTracks.find((trackRef): trackRef is TrackReference => {
			if (!isTrackReference(trackRef)) {
				return false;
			}
			const participant = trackRef.participant;
			return Boolean(participant && !participant.isLocal && trackRef.publication?.videoTrack);
		});
	}, [remoteCameraTracks]);

	useEffect(() => {
		if (!room) {
			return;
		}
	
		let cancelled = false;
		const setup = async () => {
			try {
				const tracks = await createLocalTracks({
					audio: true,
					video: { facingMode: 'user', resolution: { width: 640, height: 360 } },
				});

				if (cancelled) {
					tracks.forEach((track) => track.stop());
					return;
				}

				const videoTrack = tracks.find((track): track is LocalVideoTrack => track.kind === Track.Kind.Video) ?? null;
				const audioTrack = tracks.find((track): track is LocalAudioTrack => track.kind === Track.Kind.Audio) ?? null;

				localTracksRef.current = { videoTrack, audioTrack };

				if (videoTrack && localVideoRef.current) {
					videoTrack.attach(localVideoRef.current);
				}

				if (room.state === 'connected') {
					void publishLocalTracks(room, localTracksRef.current, publishedRef.current);
				} else {
					const handleConnected = () => {
						void publishLocalTracks(room, localTracksRef.current, publishedRef.current);
					};
					room.once(RoomEvent.Connected, handleConnected);
				}
			} catch (error) {
				console.error('Failed to initialize local media tracks', error);
			}
		};

		void setup();

		return () => {
			cancelled = true;
			const { videoTrack, audioTrack } = localTracksRef.current;
			if (videoTrack) {
				videoTrack.stop();
				if (localVideoRef.current) {
					videoTrack.detach(localVideoRef.current);
				} else {
					videoTrack.detach();
				}
				room.localParticipant.unpublishTrack(videoTrack, true);
			}
			if (audioTrack) {
				audioTrack.stop();
				audioTrack.detach();
				room.localParticipant.unpublishTrack(audioTrack, true);
			}
			localTracksRef.current = { videoTrack: null, audioTrack: null };
			publishedRef.current = { video: false, audio: false };
		};
	}, [room]);

	useEffect(() => {
		const { videoTrack } = localTracksRef.current;
		if (!videoTrack) {
			return;
		}
		if (webcamEnabled) {
			void videoTrack.unmute();
		} else {
			void videoTrack.mute();
		}
	}, [webcamEnabled]);

	useEffect(() => {
		const { audioTrack } = localTracksRef.current;
		if (!audioTrack) {
			return;
		}
		if (micMuted) {
			void audioTrack.mute();
		} else {
			void audioTrack.unmute();
		}
	}, [micMuted]);

	return (
		<div className="w-56 space-y-3">
			<div className="flex justify-between gap-2">
				<button
					type="button"
					onClick={() => setWebcamEnabled(!webcamEnabled)}
					className={`flex-1 rounded-md border px-2 py-1 text-xs transition ${webcamEnabled ? 'bg-slate-800 text-white' : 'bg-slate-600 text-slate-300'}`}
				>
					<Video className="mr-1 inline-block h-3 w-3" />
					{webcamEnabled ? 'Camera On' : 'Camera Off'}
				</button>
				<button
					type="button"
					onClick={() => setMicMuted(!micMuted)}
					className={`flex-1 rounded-md border px-2 py-1 text-xs transition ${!micMuted ? 'bg-slate-800 text-white' : 'bg-slate-600 text-slate-300'}`}
				>
					<Mic className="mr-1 inline-block h-3 w-3" />
					{micMuted ? 'Mic Off' : 'Mic On'}
				</button>
				<button
					type="button"
					onClick={() => setShowRemote(!showRemote)}
					className={`flex-1 rounded-md border px-2 py-1 text-xs transition ${showRemote ? 'bg-slate-800 text-white' : 'bg-slate-600 text-slate-300'}`}
				>
					<Users className="mr-1 inline-block h-3 w-3" />
					{showRemote ? 'Hide' : 'Show'}
				</button>
			</div>

			<div className="flex flex-col gap-2">
				<div className="h-32 w-full overflow-hidden rounded-md bg-black">
					<video
						ref={localVideoRef}
						autoPlay
						muted
						playsInline
						className="h-full w-full object-cover"
					/>
				</div>

				{showRemote && remoteVideoTrackRef && (
					<div className="h-32 w-full overflow-hidden rounded-md bg-black">
						<VideoTrack
							trackRef={remoteVideoTrackRef}
							className="h-full w-full object-cover"
						/>
					</div>
				)}
			</div>
		</div>
	);
};
