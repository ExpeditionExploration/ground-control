// src/modules/media/context/MediaModuleContext.tsx
// Holds shared mission-control data + LiveKit helpers for media components.
import { createContext, useContext } from 'react';
import type { MediaModuleClient } from '../client';

export type MediaContextValue = {
  module: MediaModuleClient;
  liveKitUrl: string;
  missionControlHost: string;
};

const MediaModuleContext = createContext<MediaContextValue | undefined>(undefined);

export const MediaModuleProvider: React.FC<{ value: MediaContextValue; children: React.ReactNode }> = ({ value, children }) => (
  <MediaModuleContext.Provider value={value}>{children}</MediaModuleContext.Provider>
);

export const useMediaModule = () => {
  const ctx = useContext(MediaModuleContext);
  if (!ctx) throw new Error('useMediaModule must be used inside MediaModuleProvider');
  return ctx;
};
