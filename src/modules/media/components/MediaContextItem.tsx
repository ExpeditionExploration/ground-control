import { useState, useEffect, useRef } from 'react';
import {
    ControlBar,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks,
    useLocalParticipant,
    RoomContext,
} from '@livekit/components-react';
import { Room, Track } from 'livekit-client';
import { Radio, Wifi, Video, AlertCircle } from 'lucide-react';
import { useGroundOperatorAnnounce } from './hooks/useGroundOperatorAnnounce';
import { ViewProps } from 'src/client/user-interface';
import { MediaModuleClient } from '../client';
import { useGroundOperatorConnected } from './hooks/useGroundOperatorConnected';
import { useGroundOperatorDebug } from './hooks/useGroundOperatorDebug';
import { useGroundOperatorDisconnect } from './hooks/useGroundOperatorDisconnect';
import { useGroundOperatorStream } from './hooks/useGroundOperatorStream';
import { TokenErrorResponse, TokenSuccessResponse, useGroundOperatorToken } from './hooks/useGroundOperatorToken';
import { useGroundOperatorVideoStream } from './hooks/useGroundOperatorVideoStream';

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
    const [searchTerm, setSearchTerm] = useState('');
    const [droneStreamUrl, setDroneStreamUrl] = useState<string | null>(null);
    const [missionControlToken, setMissionControlToken] = useState<TokenSuccessResponse | TokenErrorResponse | null>(null);

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
        setDroneMjpegStreamUrl(`http://${hostname}:${portSegment}/${pathSegment}`);
    }, []);


    const {
        announce,
        data: announceData,
        error: announceError,
        isLoading: announceIsLoading
    } = useGroundOperatorAnnounce({
        missionControlHost: module.config.modules.media.missionControlHost,
    });
    const {
        connectedDrones,
        error: connectedError,
        isLoading: connectedIsLoading,
        refresh: connectedRefresh
    } = useGroundOperatorConnected(module.config.modules.media.missionControlHost);
    const {
        error: debugError,
        isLoading: debugIsLoading,
        refresh: debugRefresh
    } = useGroundOperatorDebug(module.config.modules.media.missionControlHost);
    const {
        error: disconnectError,
        isLoading: disconnectIsLoading,
        disconnect: groundOperatorDisconnect
    } = useGroundOperatorDisconnect(module.config.modules.media.missionControlHost);
    const {
        connectedDrones: streamConnectedDrones,
        isConnected: streamIsConnected,
        error: streamError,
        reconnect: streamReconnect,
        disconnect: streamDisconnect,
    } = useGroundOperatorStream({
        missionControlHost: module.config.modules.media.missionControlHost,
        enabled: status === 'connected',
    });
    const {
        data: livekitTokenData,
        error: tokenError,
        isLoading: tokenIsLoading,
        requestToken
    } = useGroundOperatorToken({
        missionControlHost: module.config.modules.media.missionControlHost,
    });
    const {
        data: videoStreamData,
        error: videoStreamError,
        isLoading: videoStreamIsLoading,
    } = useGroundOperatorVideoStream({
        missionControlHost: module.config.modules.media.missionControlHost,
    });

    // Request token
    useEffect(() => {
        if (!selectedDrone) return;
        const tok = async () => {
            const res = await requestToken({ macAddress: selectedDrone.macAddress });
            if (res.ok) {
                console.log('Token received:', res);
                setMissionControlToken(res.data!);
            }
        };
        requestToken({ macAddress: selectedDrone.macAddress });
    }, [selectedDrone]);

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


    // 🔄 Fetch selected drone stream address.
    // useEffect(() => {
    //     const videoReq = (action: string) => fetch(`${module.config.modules.media.missionControlHost}api/ground-operator/stream`, {
    //         method: 'GET',
    //         headers: { 'Content-Type': 'application/json' },
    //         // body: JSON.stringify({
    //         //     mac: selectedDrone!.macAddress,
    //         //     action: action,
    //         // })
    //     });

    //     const updateDroneVideoUrl = async () => {
    //         if (!selectedDrone) {
    //             setDroneStreamUrl(null);
    //             return;
    //         }
    //         const videoResp = await videoReq('start');
    //         const responseData = await videoResp.json();
    //         console.log('🚀 Video Stream Response:', responseData);
    //         setDroneStreamUrl(responseData.url);
    //     };
    //     updateDroneVideoUrl();

    //     return () => {
    //             if (!selectedDrone) return;

    //             const videoResp = videoReq('stop')
    //             .then(res => res.json())
    //             .then(responseData => {
    //                 console.log('🚀 Video Stream Stopped:', responseData);
    //             })
    //             .catch(error => {
    //                 console.error('❌ Failed to stop video stream:', error);
    //             });
    //     };
    // }, [selectedDrone]);


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

    // Request LiveKit token
    // useEffect(() => {
    //     if (!selectedDrone) return;
    //     const tok = async () => {
    //         const resp = await fetch(`${module.config.modules.media.missionControlHost}api/ground-operator/token`, {
    //             method: 'POST',
    //             headers: { 'Content-Type': 'application/json' },
    //             body: JSON.stringify({ macAddress: selectedDrone.macAddress }),
    //         });

    //         if (!resp.ok) {
    //             const error = await resp.json();
    //             throw new Error(error.error || 'Failed to get token');
    //         }

    //         const data = await resp.json();
    //         console.log("LiveKit token:",  data);
    //         setLiveKitConnectionData(data.token);
    //     };
    //     if (selectedDrone) {
    //         tok();
    //     }
    // }, [selectedDrone]);


    useEffect(() => {
        if (!selectedDrone) return;
        handleConnect(selectedDrone!);
    }, [selectedDrone]);

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

    // 🔍 Filter drones based on search term
    const filteredDrones = drones.filter(
        (drone) =>
            drone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            drone.macAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
            drone.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ✅ Connected state - Streaming video
    return (
        <RoomContext.Provider value={roomInstance}>
            <div className="h-full w-full cover">
                {/* Video Feed */}
                {/* <GroundOperatorVideoFeed droneStreamUrl={droneStreamUrl ?? undefined} /> */}
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

//             {/* Local camera preview info */}
//             <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
//                 <p className="text-sm text-white flex items-center gap-2">
//                     <Video className="h-4 w-4 text-green-400" />
//                     Publishing: {localParticipant?.identity}
//                 </p>
//                 <p className="text-xs text-slate-300 mt-1">
//                     Participants in room: {tracks.length}
//                 </p>
//             </div>

//             <GridLayout
//                 tracks={tracks}
//                 style={{ height: 'calc(100vh - 80px - var(--lk-control-bar-height))' }}
//             >
//                 <ParticipantTile />
//             </GridLayout>
//         </div>
//     );
// }







// import { ViewProps } from 'src/client/user-interface';
// import { type MediaModuleClient } from '../client';
// import { LiveKitRoom } from '@livekit/components-react';
// import { LocalParticipantPublisher } from './LocalParticipantPublisher';
// import { useState, useEffect } from 'react';

// export const MediaContextItem: React.FC<ViewProps<MediaModuleClient>> = ({
//     module,
// }) => {
//     // <img src={`${location.protocol}//${location.hostname}:1984/api/stream.mjpeg?src=camera1`} className='w-full h-full object-cover'/> 
//     const [token, setToken] = useState<string | null>(null);

//     useEffect(() => {
//         const fetchToken = async () => {
//             module.logger.info(`Fetching LiveKit token from token server from ${module.config.modules.media.tokenServer}/token`);
//             const response = await fetch(`${module.config.modules.media.tokenServer}/token`, {
//                 method: 'POST',
//                 headers: {
//                     'Content-Type': 'application/json',
//                 },
//                 body: JSON.stringify({
//                     room: "drone-room",
//                     identity: "the-drone", 
//                 }),
//             });
//             const data = await response.json();
//             if (response.ok) {
//                 module.logger.info('Successfully fetched LiveKit token. Storing it in working memory.');
//                 setToken(data.token);
//             } else {
//                 module.logger.error('Failed to fetch LiveKit token:', data);
//             }
//         };

//         fetchToken();
//     }, []);

//     return (
//         <LiveKitRoom
//             token={token}
//             serverUrl={module.config.modules.media.liveKitUrl}
//             connect={Boolean(token && module.config.modules.media.liveKitUrl)}>
//                 <LocalParticipantPublisher />
//         </LiveKitRoom>
//     );
// };
