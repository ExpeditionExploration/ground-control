import { useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { RoomContext } from '@livekit/components-react';
import type { ViewProps } from 'src/client/user-interface';
import type { MediaModuleClient } from '../client';
import { MediaModuleProvider } from '../context/MediaModuleContext';
import { MEDIA_PORTAL_SLOTS } from './MediaPortalAnchors';
import { MediaContextItem } from './MediaContextItem';
import { TakePictureButton } from './TakePictureButton';
import { RecordButton } from './RecordButton';
import { WebCam } from './WebCam';

export const MediaModuleShell: React.FC<ViewProps<MediaModuleClient>> = ({ module }) => {
    const version = useSyncExternalStore(
        (listener) => module.subscribeUpdates(listener),
        () => module.getVersion(),
        () => module.getVersion(),
    );

    const takePictureTarget = module.getPortalTarget(MEDIA_PORTAL_SLOTS.footerTakePicture);
    const recordTarget = module.getPortalTarget(MEDIA_PORTAL_SLOTS.footerRecord);
    const webCamTarget = module.getPortalTarget(MEDIA_PORTAL_SLOTS.footerWebcam);
    const contextValue = useMemo(() => ({
        module,
        livekitUrl: module.livekitUrl,
        platformUrl: module.platformUrl,
        droneId: module.droneId,
        macAddress: module.macAddress,
        room: null,
    }), [module]);

    return (
        <MediaModuleProvider value={contextValue}>
            <RoomContext.Provider value={contextValue.room}>
                <MediaContextItem module={module} />
                {takePictureTarget && createPortal(<TakePictureButton module={module} />, takePictureTarget)}
                {recordTarget && createPortal(<RecordButton module={module} />, recordTarget)}
                {/*webCamTarget && createPortal(<WebCam />, webCamTarget)*/}
            </RoomContext.Provider>
        </MediaModuleProvider>
    );
};
