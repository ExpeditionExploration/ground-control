import { ViewProps } from 'src/client/user-interface';
import { type MediaModuleClient } from '../client';
import { LiveKitRoom } from '@livekit/components-react';
import { LocalParticipantPublisher } from './LocalParticipantPublisher';
import { useState, useEffect } from 'react';

export const MediaContextItem: React.FC<ViewProps<MediaModuleClient>> = ({
    module,
}) => {
    // <img src={`${location.protocol}//${location.hostname}:1984/api/stream.mjpeg?src=camera1`} className='w-full h-full object-cover'/> 
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const fetchToken = async () => {
            module.logger.info(`Fetching LiveKit token from token server from ${module.config.modules.media.tokenServer}/token`);
            const response = await fetch(`${module.config.modules.media.tokenServer}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    room: "drone-room",
                    identity: "mission-control-client", 
                }),
            });
            const data = await response.json();
            if (response.ok) {
                module.logger.info('Successfully fetched LiveKit token. Storing it in working memory.');
                setToken(data.token);
            } else {
                module.logger.error('Failed to fetch LiveKit token:', data);
            }
        };

        fetchToken();
    }, []);

    return (
        <LiveKitRoom
            token={token}
            serverUrl={module.config.modules.media.liveKitUrl}
            connect={Boolean(token && module.config.modules.media.liveKitUrl)}>
                <LocalParticipantPublisher />
        </LiveKitRoom>
    );
};
