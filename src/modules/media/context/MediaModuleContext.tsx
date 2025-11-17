// src/modules/media/context/MediaModuleContext.tsx
// Holds shared mission-control data + LiveKit helpers for media components.
import { createContext, useContext } from 'react';
import type { MediaModuleClient } from '../client';
import { Room } from 'livekit-client';

export type MediaWebcamControls = {
    webcamEnabled: boolean;
    setWebcamEnabled?: (value: boolean) => void;
    micMuted: boolean;
    setMicMuted?: (value: boolean) => void;
    showRemote: boolean;
    setShowRemote?: (value: boolean) => void;
};

export type MediaContextValue = {
    module: MediaModuleClient;
    livekitUrl?: string;
    platformUrl?: string;
    droneId?: string;
    macAddress?: string;
    room?: Room;
    identity?: string;
    roomName?: string;
    missionId?: string;
    webcamControls?: MediaWebcamControls;
};

const MediaModuleContext = createContext<MediaContextValue | undefined>(undefined);

export const MediaModuleProvider: React.FC<{ value: MediaContextValue; children: React.ReactNode }> = ({ value, children }) => (
    <MediaModuleContext.Provider value={value}>{children}</MediaModuleContext.Provider>
);

export const useMediaModuleContext = () => {
    const ctx = useContext(MediaModuleContext);
    if (!ctx) throw new Error('useMediaModuleContext must be used inside MediaModuleProvider');
    return ctx;
};
