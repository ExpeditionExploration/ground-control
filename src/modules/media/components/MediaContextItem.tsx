import { useState, useEffect, useRef, useMemo } from 'react';
import {
    ControlBar,
    RoomAudioRenderer,
    useTracks,
    useLocalParticipant,
    RoomContext,
} from '@livekit/components-react';
import { Track, Room, TextStreamReader, LocalVideoTrack, LocalTrackPublication } from 'livekit-client';
import { useGroundOperatorAnnounce } from './hooks/useGroundOperatorAnnounce';
import { ViewProps } from 'src/client/user-interface';
import { MediaModuleClient } from '../client';
import { useMediaModuleContext } from '../context/MediaModuleContext';
import { CarTaxiFront } from 'lucide-react';


export const MediaContextItem: React.FC<ViewProps<MediaModuleClient>> = ({ module }) => (
    <MediaContextItemInternal module={module} />
);

const MediaContextItemInternal: React.FC<ViewProps<MediaModuleClient>> = ({ module }) => {

    const ctx = useMediaModuleContext();
    ctx.livekitUrl = module.config.modules.common.livekitUrl;
    ctx.platformUrl = module.config.modules.common.platformUrl;
    ctx.droneId = module.config.modules.common.droneId;
    ctx.macAddress = module.config.modules.common.macAddress;
    ctx.missionId = null;
    console.log("module:", module.config.modules.common);

    // Ensure a Room instance exists synchronously so children using RoomContext have a value immediately.
    if (!ctx.room) {
        ctx.room = new Room();
    }

    const heartbeat = useRef<NodeJS.Timeout | null>(null);

    const [connectionState, setConnectionState] = useState<
        'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
    const [droneMjpegStreamUrl, setDroneMjpegStreamUrl] = useState<string | null>(null);

    console.log(`!ctx.livekitUrl || !(ctx.droneId || ctx.macAddress) || !ctx.platformUrl`)
    console.log(`livekitUrl: ${ctx.livekitUrl}, droneId: ${ctx.droneId}, macAddress: ${ctx.macAddress}, platformUrl: ${ctx.platformUrl}`)
    if (!ctx.livekitUrl || !(ctx.droneId || ctx.macAddress) || !ctx.platformUrl) {
        return <div className="p-4 text-red-500">Media Module not configured properly. Missing livekitUrl, droneId, platformUrl, or macAddress.</div>;
    }

    async function connectDrone() {
        setConnectionState('connecting');
        console.log("Connecting.");
        // 1. Request token
        const tokenRes = await fetch(`${ctx.platformUrl}/api/ground-operator/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ macAddress: ctx.macAddress })
        });
        let token, roomName, identity;
        const tokenJson = await tokenRes.json();
        console.log("tokenRes:", tokenJson);
        try {
            const { token: t, room: r, identity: i } = tokenJson;
            token = t;
            roomName = r;
            identity = i;
            console.log("Received token response:", { token, roomName, identity });
        } catch (e) {
            console.error("Failed to parse token response", e);
            setConnectionState('error');
            return;
        }

        console.log("Connecting to LiveKit room:", { livekitUrl: ctx.livekitUrl, roomName, identity });
        // 2. Connect to LiveKit (Room already created synchronously above)
        try {
            if (!ctx.room) {
                ctx.room = new Room();
            }
            await ctx.room!.connect(ctx.livekitUrl!, token);
        } catch (e) {
            console.error("Failed to connect to LiveKit room", e);
            setConnectionState('error');
            return;
        }

        console.log("Announcing connection");
        // 3. Announce connection
        const announceRes = await fetch(`${ctx.platformUrl}/api/ground-operator/announce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ macAddress: ctx.macAddress, livekitIdentity: identity })
        });
        try {
            ctx.missionId = await announceRes.json();
        } catch (e) {
            console.error("Failed to announce connection", e);
            setConnectionState('error');
            return;
        }

        // 4. Start heartbeat
        heartbeat.current = setInterval(async () => {
            await fetch(`${ctx.platformUrl}/api/ground-operator/announce`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ macAddress: ctx.macAddress, livekitIdentity: identity })
            });
        }, 20000);

        console.log("Connected.");
        setConnectionState('connected');
    };
    // 5. Handle disconnect
    const disconnectDrone = async () => {
        clearInterval(heartbeat.current);
        heartbeat.current = null;
        await fetch(`${ctx.platformUrl}/api/ground-operator/disconnect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ macAddress: ctx.macAddress })
        });
        await ctx.room?.disconnect();
    };

    // Schedule connect on mount
    useEffect(() => {
        connectDrone();
        return () => {
            disconnectDrone();
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        const { hostname } = window.location;
        // Access optional fields defensively (not part of typed Config interface yet)
        const portSegment = (module.config as any).droneStreamPort ?? '1984';
        const pathSegment = (module.config as any).droneStreamPath ?? 'api/stream.mjpeg?src=camera1';
        console.log("Setting drone MJPEG stream URL to:", `https://${hostname}:${portSegment}/${pathSegment}`);
        setDroneMjpegStreamUrl(`https://${hostname}:${portSegment}/${pathSegment}`);
    }, []);

    // Render based on connection state
    const output = useMemo(() => {
        // Always provide the RoomContext; internal content varies by connection state.
        return (
            <RoomContext.Provider value={ctx.room!}>
                {connectionState === 'connected' && (
                    <div className="h-full w-full cover">
                        <DroneVideoFeed droneVideoUrl={droneMjpegStreamUrl ?? undefined} />
                        <RoomAudioRenderer />
                        <ControlBar />
                    </div>
                )}
                {connectionState === 'connecting' && (
                    <div className="p-4">Connecting to drone...</div>
                )}
                {connectionState === 'disconnected' && (
                    <div className="p-4 text-red-500">Disconnected from drone.</div>
                )}
                {connectionState === 'error' && (
                    <div className="p-4 text-red-500">Error connecting to drone.</div>
                )}
            </RoomContext.Provider>
        );
    }, [connectionState, ctx.room, droneMjpegStreamUrl]);

    // Register data publisher and text stream handler once the room exists.
    const textHandlerRegisteredRef = useRef(false);
    // useEffect(() => {
    //     if (connectionState !== 'connected') return;
    //     // Publish outgoing broadcaster events
    //     module.broadcaster.on('*:*', (data) => {
    //         if (connectionState !== 'connected') return;
    //         const encoder = new TextEncoder();
    //         ctx.room!.localParticipant.publishData(
    //             encoder.encode(JSON.stringify(data))
    //         ).catch((error) => {
    //             console.error('Failed to publish data to LiveKit', error);
    //         });
    //     });
    //     // Register text stream handler once
    //     if (!textHandlerRegisteredRef.current) {
    //         ctx.room.registerTextStreamHandler('drone-control', async (reader: TextStreamReader, participant: { identity: string }) => {
    //             console.log('Data stream started from participant:', participant.identity);
    //             console.log('Stream information:', reader.info);
    //             for await (const chunk of reader) {
    //                 try {
    //                     const parsed = JSON.parse(chunk);
    //                     const cmd = parsed?.droneControl?.command;
    //                     if (cmd) {
    //                         module.broadcaster.emit('drone-remote-control:command', {
    //                             command: cmd,
    //                             identity: participant.identity,
    //                         });
    //                     }
    //                 } catch (e) {
    //                     console.error('Failed to parse data message', e);
    //                 }
    //             }
    //         });
    //         textHandlerRegisteredRef.current = true;
    //     }
    // }, [ctx.room, module.broadcaster, connectionState]);

    return output;
};

// 📹 Video feed component showing local camera and participants
function DroneVideoFeed({ droneVideoUrl }) {
    const { localParticipant } = useLocalParticipant();
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hasInitialised = useRef(false);
    const publicationRef = useRef<LocalTrackPublication | null>(null);
    const ctx = useMediaModuleContext();

    // Copy image to canvas
    useEffect(() => {
        if (imgRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const render = () => {
                requestAnimationFrame(() => {
                    if (!imgRef.current) return;
                    const context = canvas.getContext('2d');
                    imgRef.current.crossOrigin = "anonymous";
                    if (!context) return;
                    canvas.width = imgRef.current.naturalWidth;
                    canvas.height = imgRef.current.naturalHeight;

                    context.drawImage(imgRef.current, 0, 0, canvas.width, canvas.height);
                    render();
                });
            };
            render();
        }
    }, [imgRef.current]);

    // Publish canvas track
    const [capturedTrackFromCanvas, setCapturedTrackFromCanvas]
        = useState<MediaStreamTrack | null>(null);
    useEffect(() => {
        let localVideo: LocalVideoTrack;
        const publishIt = () => {
            if (!imgRef.current || !canvasRef.current) {
                return;
            }
            if (hasInitialised.current) return;
            hasInitialised.current = true;
            console.log("Publishing canvas track as LocalVideoTrack");

            canvasRef.current.width = imgRef.current.naturalWidth;
            canvasRef.current.height = imgRef.current.naturalHeight;

            const mediaTrack = canvasRef.current?.captureStream(30).getVideoTracks()[0];
            console.log("Captured mediaTrack from canvas:", mediaTrack);
            const [sizex, sizey] = [canvasRef.current?.width, canvasRef.current?.height];
            if (!mediaTrack || !sizex || !sizey) {
                console.error("Failed to capture track from canvas. Scheduling retry in 5s.");
                setTimeout(() => {
                    hasInitialised.current = false;
                    publishIt();
                }, 5000);
                return;
            }
            // Wrap raw MediaStreamTrack as LocalVideoTrack so we keep a stable handle
            const p = () => {
                localVideo = new LocalVideoTrack(mediaTrack);
                localParticipant
                    .publishTrack(localVideo, {
                        name: 'drone:camera',
                        source: Track.Source.Unknown,
                    })
                    .then((pub) => {
                        publicationRef.current = pub;
                    })
                    .catch((err) => {
                        console.error('Failed to publish canvas track', err);
                        try {
                            localVideo.stop();
                        } catch { }
                    });
            }
            ctx.room.on('connected', () => {
                p();
            });
        };
        publishIt();
        return () => {
            // Unpublish by publication SID to ensure proper matching
            if (publicationRef.current) {
                try {
                    localParticipant.unpublishTrack(publicationRef.current.track, true);
                } catch (e) {
                    console.warn('Failed to unpublish canvas track', e);
                }
                publicationRef.current = null;
            }
            try {
                // Stop the local video track to release the canvas capture
                localVideo.stop();
            } catch { }
        };
    }, [canvasRef.current, capturedTrackFromCanvas]);

    return (
        <div className="h-full flex flex-col">
            {/* Canvas to stream from */}
            <div className="absolute inset-0 w-full h-full">
                <img ref={imgRef} src={droneVideoUrl} className="absolute inset-0 w-full h-full object-contain hidden" />
                <canvas ref={canvasRef} className="absolute w-full h-full object-contain inset-0 rotate-180" />
            </div>
        </div>
    );
}
