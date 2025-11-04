import { z } from 'zod';

// 🔌 MAC address validation regex
const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

// 🚁 Ground Operator Announce Schema
export const GroundOperatorAnnounceSchema = z.object({
    macAddress: z.string().regex(MAC_ADDRESS_REGEX, 'Invalid MAC address format'),
    livekitIdentity: z.string().min(1, 'LiveKit identity is required'),
});

export type GroundOperatorAnnounce = z.infer<typeof GroundOperatorAnnounceSchema>;

// 🎫 Token request schema for ground operator
export const GroundOperatorTokenRequestSchema = z.object({
    macAddress: z.string().regex(MAC_ADDRESS_REGEX, 'Invalid MAC address format'),
});

export type GroundOperatorTokenRequest = z.infer<typeof GroundOperatorTokenRequestSchema>;

// 📊 Connected Ground Operator Drone (what dashboard sees)
export const ConnectedGroundOperatorDroneSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    model: z.string(),
    macAddress: z.string(),
    status: z.enum(['ONLINE', 'IN_MISSION']),
    clerkOrgId: z.string(),
    lastOnlineAt: z.date(),
    connectedAt: z.date(),
});

export type ConnectedGroundOperatorDrone = z.infer<typeof ConnectedGroundOperatorDroneSchema>;
