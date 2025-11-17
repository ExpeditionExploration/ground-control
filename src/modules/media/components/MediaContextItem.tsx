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
import { identity } from 'mathjs';


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
    useEffect(() => {
        if (connectionState !== 'connected') return;
        // Publish outgoing broadcaster events
        module.broadcaster.on('*:*', (data) => {
            if (connectionState !== 'connected') return;
            const encoder = new TextEncoder();
            ctx.room!.localParticipant.publishData(
                encoder.encode(JSON.stringify(data))
            ).catch((error) => {
                console.error('Failed to publish data to LiveKit', error);
            });
        });
        // Register text stream handler once
        if (!textHandlerRegisteredRef.current) {
            ctx.room.registerTextStreamHandler('commands', async (reader: TextStreamReader, participant: { identity: string }) => {
                for await (const chunk of reader) {
                    try {
                        const parsed = JSON.parse(chunk);
                        if (parsed.command) {
                            module.broadcaster.emit('drone-remote-control:command', {
                                ...parsed, 
                                identity: participant.identity,
                            });
                        }
                    } catch (e) {
                        console.error('Failed to parse data message', e);
                    }
                }
            });
            textHandlerRegisteredRef.current = true;
        }
    }, [ctx.room, module.broadcaster, connectionState]);

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
    const [imageLoaded, setImageLoaded] = useState(false);
    const renderLoopStarted = useRef(false);
    const lastFrameTime = useRef<number>(Date.now());
    const streamHealthCheckInterval = useRef<NodeJS.Timeout | null>(null);

    // Handle image load event and monitor stream health
    useEffect(() => {
        const img = imgRef.current;
        if (!img) return;

        const handleLoad = () => {
            console.log("🖼️ Image loaded, dimensions:", img.naturalWidth, "x", img.naturalHeight);
            setImageLoaded(true);
            lastFrameTime.current = Date.now();
        };

        const handleError = (e: Event) => {
            console.error("❌ Image failed to load:", e);
            setImageLoaded(false);
            
            // Attempt to reload after error
            setTimeout(() => {
                if (img && droneVideoUrl) {
                    console.log("🔄 Attempting to reload image stream...");
                    img.src = droneVideoUrl + '?t=' + Date.now(); // Add timestamp to bypass cache
                }
            }, 2000);
        };

        // Check if image is already loaded
        if (img.complete && img.naturalWidth > 0) {
            console.log("🖼️ Image already loaded");
            setImageLoaded(true);
            lastFrameTime.current = Date.now();
        } else {
            img.addEventListener('load', handleLoad);
            img.addEventListener('error', handleError);
        }

        // Monitor stream health - check if frames are still being received
        streamHealthCheckInterval.current = setInterval(() => {
            const timeSinceLastFrame = Date.now() - lastFrameTime.current;
            
            // If no new frames for 10 seconds, consider stream stalled
            if (timeSinceLastFrame > 10000 && imageLoaded) {
                console.warn("⚠️ MJPEG stream appears stalled (no new frames for 10s), attempting reload...");
                setImageLoaded(false);
                
                if (img && droneVideoUrl) {
                    // Force reload by changing src with timestamp
                    img.src = droneVideoUrl + '?t=' + Date.now();
                }
            }
        }, 5000); // Check every 5 seconds

        return () => {
            img.removeEventListener('load', handleLoad);
            img.removeEventListener('error', handleError);
            
            if (streamHealthCheckInterval.current) {
                clearInterval(streamHealthCheckInterval.current);
                streamHealthCheckInterval.current = null;
            }
        };
    }, [droneVideoUrl]);

    // Copy image to canvas - start render loop when image is loaded
    useEffect(() => {
        if (!imageLoaded || !imgRef.current || !canvasRef.current) {
            if (renderLoopStarted.current) {
                renderLoopStarted.current = false;
            }
            return;
        }

        if (renderLoopStarted.current) {
            return;
        }

        const canvas = canvasRef.current;
        const img = imgRef.current;
        const context = canvas.getContext('2d');
        
        if (!context) {
            console.error("❌ Failed to get canvas 2D context");
            return;
        }

        let animationFrameId: number | null = null;
        let dimensionCheckTimeout: NodeJS.Timeout | null = null;

        // Wait for valid dimensions before starting
        const waitForDimensions = () => {
            if (!img.naturalWidth || !img.naturalHeight) {
                console.log("⏳ Waiting for image dimensions...");
                dimensionCheckTimeout = setTimeout(waitForDimensions, 50);
                return;
            }

            // Now we have valid dimensions, start the render loop
            renderLoopStarted.current = true;
            console.log("🎨 Starting canvas render loop");

            img.crossOrigin = "anonymous";

            // Set initial canvas dimensions from image
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            console.log("🎨 Canvas initialized with dimensions:", canvas.width, "x", canvas.height);

            let frameCount = 0;
            let lastLogTime = Date.now();
            
            const render = () => {
                if (!img || !canvas || !context) return;
                
                // Update dimensions if image size changes
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    if (canvas.width !== img.naturalWidth || canvas.height !== img.naturalHeight) {
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        console.log("🎨 Canvas dimensions updated:", canvas.width, "x", canvas.height);
                    }
                }

                // Only draw if canvas has valid dimensions
                if (canvas.width === 0 || canvas.height === 0) {
                    animationFrameId = requestAnimationFrame(render);
                    return;
                }

                try {
                    context.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    // Update last frame time to indicate stream is healthy
                    lastFrameTime.current = Date.now();
                    frameCount++;
                    
                    // Log frame rate every 10 seconds for monitoring
                    const now = Date.now();
                    if (now - lastLogTime > 10000) {
                        const fps = frameCount / ((now - lastLogTime) / 1000);
                        console.log(`📊 Canvas rendering at ~${fps.toFixed(1)} FPS`);
                        frameCount = 0;
                        lastLogTime = now;
                    }
                } catch (err) {
                    console.error("❌ Error drawing image to canvas:", err);
                }
                
                animationFrameId = requestAnimationFrame(render);
            };

            render();
        };

        // Start waiting for dimensions
        waitForDimensions();

        return () => {
            // Clear dimension check timeout
            if (dimensionCheckTimeout) {
                clearTimeout(dimensionCheckTimeout);
            }
            
            // Cancel animation frame
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            
            renderLoopStarted.current = false;
            console.log("🛑 Canvas render loop stopped");
        };
    }, [imageLoaded]);

    // Publish canvas track - wait for image to load and canvas to be rendering
    const [capturedTrackFromCanvas, setCapturedTrackFromCanvas]
        = useState<MediaStreamTrack | null>(null);
    useEffect(() => {
        // Don't try to publish until image is loaded and canvas is rendering
        if (!imageLoaded) {
            console.log("⏳ Waiting for image to load before publishing track");
            return;
        }

        let localVideo: LocalVideoTrack | null = null;
        let cleanupCalled = false;

        const publishIt = () => {
            if (!imgRef.current || !canvasRef.current) {
                console.log("⏳ Canvas or image not ready yet");
                return;
            }
            if (hasInitialised.current) return;
            if (!localParticipant) {
                console.log("⏳ Local participant not ready yet");
                return;
            }

            hasInitialised.current = true;
            console.log("🎬 Starting canvas track publishing process");
            console.log("📊 Room connection state:", ctx.room.state);

            // Validate canvas has content before capturing
            const [sizex, sizey] = [canvasRef.current.width, canvasRef.current.height];
            if (!sizex || !sizey) {
                console.error("❌ Canvas has zero dimensions. Scheduling retry in 2s.");
                setTimeout(() => {
                    hasInitialised.current = false;
                    publishIt();
                }, 2000);
                return;
            }

            console.log(`✅ Canvas dimensions: ${sizex}x${sizey}`);

            // Add small delay to ensure canvas has rendered at least one frame
            setTimeout(() => {
                if (cleanupCalled) return;

                const mediaTrack = canvasRef.current?.captureStream(30).getVideoTracks()[0];
                console.log("📹 Captured mediaTrack from canvas:", mediaTrack);
                
                if (!mediaTrack) {
                    console.error("❌ Failed to capture track from canvas. Scheduling retry in 5s.");
                    setTimeout(() => {
                        hasInitialised.current = false;
                        publishIt();
                    }, 5000);
                    return;
                }

                // Wrap raw MediaStreamTrack as LocalVideoTrack
                localVideo = new LocalVideoTrack(mediaTrack);
                console.log("🎥 Created LocalVideoTrack from canvas stream");

                const publishTrack = () => {
                    if (cleanupCalled || !localVideo) return;

                    console.log("📤 Publishing track to LiveKit...");
                    localParticipant
                        .publishTrack(localVideo, {
                            name: 'drone:camera',
                            source: Track.Source.Camera,
                        })
                        .then((pub) => {
                            if (cleanupCalled) return;
                            publicationRef.current = pub;
                            console.log("✅ Canvas track published successfully!", {
                                trackSid: pub.trackSid,
                                trackName: pub.trackName,
                                source: pub.source
                            });
                        })
                        .catch((err) => {
                            console.error('❌ Failed to publish canvas track:', err);
                            if (localVideo && !cleanupCalled) {
                                try {
                                    localVideo.stop();
                                } catch { }
                            }
                        });
                };

                // Check if room is already connected
                if (ctx.room.state === 'connected') {
                    console.log("✅ Room already connected, publishing immediately");
                    publishTrack();
                } else {
                    console.log("⏳ Room not connected yet, waiting for connection...");
                    ctx.room.once('connected', () => {
                        console.log("✅ Room connected event fired, publishing track");
                        publishTrack();
                    });
                }
            }, 100); // Small delay to ensure canvas has rendered
        };

        publishIt();

        return () => {
            cleanupCalled = true;
            console.log("🧹 Cleaning up canvas track publication");
            
            // Unpublish by publication SID to ensure proper matching
            if (publicationRef.current) {
                try {
                    localParticipant.unpublishTrack(publicationRef.current.track, true);
                    console.log("✅ Track unpublished successfully");
                } catch (e) {
                    console.warn('⚠️ Failed to unpublish canvas track:', e);
                }
                publicationRef.current = null;
            }
            
            if (localVideo) {
                try {
                    localVideo.stop();
                    console.log("✅ Local video track stopped");
                } catch (e) {
                    console.warn('⚠️ Failed to stop local video track:', e);
                }
            }
        };
    }, [imageLoaded, canvasRef.current, capturedTrackFromCanvas, localParticipant, ctx.room]);

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
