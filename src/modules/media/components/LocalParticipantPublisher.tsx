import {useRef, useEffect} from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

export const LocalParticipantPublisher = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const streamingImageRef = useRef<HTMLImageElement | null>(null);
    const publishedTrackRef = useRef<MediaStreamTrack | null>(null);
    const {localParticipant} = useLocalParticipant();

    const onLoad = () => {
        if (!canvasRef.current || !streamingImageRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        const drawFrame = () => {
            if (!streamingImageRef.current) return;
            context.drawImage(streamingImageRef.current, 0, 0, canvas.width, canvas.height);
            requestAnimationFrame(drawFrame);
        };

        drawFrame();
    };

    const onError = () => {
        console.error('Error loading MJPEG stream');
    };

    const onAbort = () => {
        console.warn('MJPEG stream loading aborted');
    };

    useEffect(() => {
        if (!streamingImageRef.current) return;
        streamingImageRef.current.crossOrigin = "anonymous";
    }, [streamingImageRef]);

    useEffect(() => {
        if (!canvasRef.current) return;
        if (!mediaStreamRef.current) {
            mediaStreamRef.current = canvasRef.current.captureStream(30);
        }

        if (publishedTrackRef.current) return;

        const [videoTrack] = mediaStreamRef.current.getVideoTracks();
        if (!videoTrack) return;

        publishedTrackRef.current = videoTrack;
        localParticipant
            .publishTrack(videoTrack, {
                name: "drone-video",
                source: Track.Source.Camera,
            })
            .catch((error) => {
                console.error('Failed to publish canvas stream', error);
                publishedTrackRef.current = null;
                videoTrack.stop();
            });

        return () => {
            if (publishedTrackRef.current) {
                localParticipant.unpublishTrack(publishedTrackRef.current);
                publishedTrackRef.current.stop();
                publishedTrackRef.current = null;
            }
            mediaStreamRef.current = null;
        };
    }, [localParticipant]);

    return (
        <div className="absolute inset-0 w-full h-full">
            <img
                src={`${location.protocol}//${location.hostname}:1984/api/stream.mjpeg?src=camera1`} 
                className='w-full h-full object-cover hidden'
                onLoad={onLoad}
                onError={onError}
                onAbort={onAbort}
                ref={streamingImageRef}
                /> 
            <canvas ref={canvasRef} className='w-full h-full object-cover'/>
        </div>
    );
};