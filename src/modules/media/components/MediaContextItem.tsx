import { useState, useEffect, useRef } from 'react';
import {
    ControlBar,
    RoomAudioRenderer,
    useTracks,
    useLocalParticipant,
    RoomContext,
} from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import { useGroundOperatorAnnounce } from './hooks/useGroundOperatorAnnounce';
import { ViewProps } from 'src/client/user-interface';
import { MediaModuleClient } from '../client';

interface RegisteredDrone {
    id: string;
    name: string;
    model: string;
    macAddress: string;
    status: string;
}

export const MediaContextItem: React.FC<ViewProps<MediaModuleClient>> = ({module}) => {
    const [drones, setDrones] = useState<RegisteredDrone[]>([]);
    const [selectedDrone, setSelectedDrone] = useState<RegisteredDrone | null>(null);
    const [roomInstance] = useState<Room>(new Room({
        adaptiveStream: true,
        dynacast: true,
    }));

    const [status, setStatus] = useState<'listing' | 'connecting' | 'connected' | 'error'>(
        'listing'
    );
    const [errorMsg, setErrorMsg] = useState('');

    const [liveKitConnectionData, setLiveKitConnectionData] = useState<{
        token: string;
        room: string;
        identity: string;
        drone: {
            id: string;
            name: string;
            macAddress: string;
            model: string;
        };
    } | null>(null);

    const [droneMjpegStreamUrl, setDroneMjpegStreamUrl] = useState<string | null>(null);
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        const { hostname } = window.location;
        const portSegment = module.config.modules.media.droneStreamPort ?? "1984";
        const pathSegment = module.config.modules.media.droneStreamPath ?? "api/stream.mjpeg?src=camera1";
        console.log("Setting drone MJPEG stream URL to:", `http://${hostname}:${portSegment}/${pathSegment}`);
        setDroneMjpegStreamUrl(`https://${hostname}:${portSegment}/${pathSegment}`);
    }, []);


    const {
        announce,
        data: announceData,
        error: announceError,
        isLoading: announceIsLoading
    } = useGroundOperatorAnnounce({
        missionControlHost: module.config.modules.media.missionControlHost,
    });

    // 🔄 Fetch registered drones (no auth, shows all)
    useEffect(() => {
        const fetchDrones = async () => {
            try {
                // ⚠️ For MVP: Fetch all drones without auth
                // TODO: Add proper authentication in production
                console.log("missionControlHost", module.config.modules.media.missionControlHost);
                const resp = await fetch(`${module.config.modules.media.missionControlHost}api/drones/all`);
                if (resp.ok) {
                    const data = await resp.json();
                    setDrones(data.drones || []);
                }
            } catch (error) {
                console.error('❌ Failed to fetch registered drones:', error);
            }
        };

        fetchDrones();
    }, []);

    // 🔄 Set selected drone to this drone.
    useEffect(() => {
        if (drones.length > 0) {
            setSelectedDrone(drones.filter(
                d => d.macAddress.toLowerCase() === module.config.modules.media.macAddress.toLowerCase()
            )[0] || null);
        }
    }, [drones]);

    // 🧹 Cleanup on unmount - disconnect if still connected
    useEffect(() => {
        return () => {
            if (selectedDrone && roomInstance.state === 'connected') {
                // 📡 Notify server about disconnection
                fetch(`${module.config.modules.media.client.missionControlHost}api/ground-operator/disconnect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        macAddress: selectedDrone.macAddress,
                    }),
                }).catch((error) => {
                    console.error('❌ Failed to notify disconnection on unmount:', error);
                });
                
                roomInstance.disconnect();
            }
        };
    }, [selectedDrone, roomInstance]);

    // 🚪 Handle browser tab close/reload - critical for proper cleanup
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (selectedDrone && roomInstance.state === 'connected') {
                // 📡 Synchronous disconnect notification using sendBeacon (works during page unload)
                const data = JSON.stringify({
                    macAddress: selectedDrone.macAddress,
                });
                
                // ⚠️ Use sendBeacon for reliable disconnect on page close
                navigator.sendBeacon(`${module.config.modules.media.client.missionControlHost}api/ground-operator/disconnect`, data);
                
                roomInstance.disconnect();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [selectedDrone, roomInstance]);

    const handleConnect = async (drone: RegisteredDrone) => {
        try {
            setStatus('connecting');
            setErrorMsg('');
            setSelectedDrone(drone);

            // 🎫 Request LiveKit token from server
            const resp = await fetch(`${module.config.modules.media.missionControlHost}api/ground-operator/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ macAddress: drone.macAddress }),
            });

            if (!resp.ok) {
                const error = await resp.json();
                throw new Error(error.error || 'Failed to get token');
            }

            const data = await resp.json();
            console.log(data);
            setLiveKitConnectionData(data.token);

            // 🔌 Connect to LiveKit room
            await roomInstance.connect(module.config.modules.media.liveKitUrl, data.token);

            // 📡 Announce drone connection (with heartbeat)
            await announce({
                macAddress: module.config.modules.media.macAddress,
                livekitIdentity: data.identity,
            });
            const announceConnection = async () => {
                
                try {
                    const response = await fetch(`${module.config.modules.media.missionControlHost}api/ground-operator/announce`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            macAddress: drone.macAddress,
                            livekitIdentity: data.identity,
                        }),
                    });
                    
                    if (!response.ok) {
                        console.error('❌ Announce failed:', response.status, await response.text());
                    } else {
                        const result = await response.json();
                        console.log('✅ Announce successful:', result);
                    }
                } catch (error) {
                    console.error('❌ Failed to announce connection:', error);
                }
            };

            // ✅ Initial announcement
            await announceConnection();

            // 🔄 Send heartbeat every 20 seconds to maintain connection status
            const heartbeatInterval = setInterval(announceConnection, 20000);

            // 🧹 Cleanup on disconnect
            roomInstance.once('disconnected', async () => {
                clearInterval(heartbeatInterval);
                
                // 📡 Notify server about disconnection
                try {
                    await fetch(`${module.config.modules.media.client.missionControlHost}api/ground-operator/disconnect`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            macAddress: drone.macAddress,
                        }),
                    });
                } catch (error) {
                    console.error('❌ Failed to notify disconnection:', error);
                }
            });

            setStatus('connected');
        } catch (error) {
            console.error('❌ Connection error:', error);
            setErrorMsg(error instanceof Error ? error.message : 'Connection failed');
            setStatus('error');
        }
    };

    const handleDisconnect = async () => {
        if (selectedDrone) {
            // 📡 Notify server before disconnecting
            try {
                await fetch(`${module.config.modules.media.client.missionControlHost}api/ground-operator/disconnect`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        macAddress: selectedDrone.macAddress,
                    }),
                });
            } catch (error) {
                console.error('❌ Failed to notify disconnection:', error);
            }
        }
        
        roomInstance.disconnect();
        setSelectedDrone(null);
        setStatus('listing');
    };

    useEffect(() => {
        if (!selectedDrone) return;
        handleConnect(selectedDrone!);
        return () => {handleDisconnect()};
    }, [selectedDrone]);

    // ✅ Connected state - Streaming video
    return (
        <RoomContext.Provider value={roomInstance}>
            <div className="h-full w-full cover">
                {/* Video Feed */}
                <DroneVideoFeed
                    droneVideoUrl={droneMjpegStreamUrl ?? undefined}
                    connData={liveKitConnectionData} />
                <RoomAudioRenderer />
                <ControlBar />
            </div>
        </RoomContext.Provider>
    );
}

// 📹 Video feed component showing local camera and participants
function DroneVideoFeed({droneVideoUrl, connData}) {
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
    useEffect(() => {
        if (hasInitialised.current) return;
        hasInitialised.current = true;

        const track = canvasRef.current?.captureStream(5).getVideoTracks()[0];
        if (!track) {
            console.error("Failed to capture track from canvas");
            return;
        }
        localParticipant.publishTrack(track, {
            name: 'drone-camera',
            source: Track.Source.Camera,
        });
        return () => {
            localParticipant.unpublishTrack(track);
        };
    }, [canvasRef.current]);

    return (
        <div className="h-full flex flex-col">
            {/* Canvas to stream from */}
            <div className="absolute inset-0 w-full h-full">
                <img ref={imgRef} src={droneVideoUrl} className="absolute inset-0 w-full h-full object-cover hidden" />
                <canvas ref={canvasRef} className="w-full h-full" />
            </div>
        </div>
    );
}
