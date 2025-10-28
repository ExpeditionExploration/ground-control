import {useRef, useEffect} from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track, VideoTrack } from 'livekit-client';

export const LocalParticipantPublisher = () => {
    const imageRef = useRef<HTMLImageElement | null>(null);
    const hasInitialised = useRef<boolean>(false);
    const { localParticipant } = useLocalParticipant();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        console.log("Setting up canvas for MJPEG stream capture");
        const canvas = canvasRef.current;
        if (!canvas) {
            console.error("Canvas ref is null");
            return;
        }
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.width = 640;
        canvas.height = 480;

        setTimeout(() => {
            document.body.append(canvas);
        }, 1000);

        const render = () => {
            requestAnimationFrame(() => {
                if (!imageRef.current) return;
                const context = canvas.getContext('2d');
                imageRef.current.crossOrigin = "anonymous";
                if (!context) return;
                canvas.width = imageRef.current.naturalWidth;
                canvas.height = imageRef.current.naturalHeight;

                context.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
                render();
            });
        };
        render();
    }, []);

    useEffect(() => {
        if(hasInitialised.current) return;
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
    }, []);

    return (
        <div className="absolute inset-0 w-full h-full">
            <img ref={imageRef} crossOrigin='anonymous' src={`${location.protocol}//${location.hostname}:1984/api/stream.mjpeg?src=camera1`} className='w-full h-full object-cover '/> 
            <canvas ref={canvasRef} className='w-full h-full object-cover ' />
        </div>
    );
};