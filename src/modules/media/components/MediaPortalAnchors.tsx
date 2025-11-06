import { useEffect, useRef } from 'react';
import type { ViewProps } from 'src/client/user-interface';
import type { MediaModuleClient } from '../client';

export const MEDIA_PORTAL_SLOTS = {
    footerTakePicture: 'media/footer/take-picture',
    footerRecord: 'media/footer/record',
    footerWebcam: 'media/footer/webcam',
} as const;

type MediaPortalSlot = (typeof MEDIA_PORTAL_SLOTS)[keyof typeof MEDIA_PORTAL_SLOTS];

type PortalAnchorProps = ViewProps<MediaModuleClient> & { slot: MediaPortalSlot };

const PortalAnchor: React.FC<PortalAnchorProps> = ({ module, slot, style, ...rest }) => {
    const elementRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) {
            return;
        }
        module.registerPortalTarget(slot, element);
        return () => {
            module.registerPortalTarget(slot, null);
        };
    }, [module, slot]);

    return (
        <div
            {...rest}
            ref={elementRef}
            style={{ ...(style ?? {}), display: 'contents' }}
        />
    );
};

export const MediaPortalTakePictureAnchor: React.FC<ViewProps<MediaModuleClient>> = ({ module }) => (
    <PortalAnchor module={module} slot={MEDIA_PORTAL_SLOTS.footerTakePicture} />
);

export const MediaPortalRecordAnchor: React.FC<ViewProps<MediaModuleClient>> = ({ module }) => (
    <PortalAnchor module={module} slot={MEDIA_PORTAL_SLOTS.footerRecord} />
);

export const MediaPortalWebCamAnchor: React.FC<ViewProps<MediaModuleClient>> = ({ module }) => (
    <PortalAnchor module={module} slot={MEDIA_PORTAL_SLOTS.footerWebcam} />
);
