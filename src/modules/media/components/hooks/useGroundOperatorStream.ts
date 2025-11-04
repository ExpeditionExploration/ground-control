import { useCallback, useEffect, useRef, useState } from 'react';

export type GroundOperatorStreamDrone = {
    id: string;
    name: string;
    macAddress: string;
    status: string;
    clerkOrgId: string;
    connectedAt: string;
    lastOnlineAt: string;
};

type StreamPayload = {
    connectedDrones: GroundOperatorStreamDrone[];
};

type StreamError = {
    message: string;
    event?: unknown;
};

type useGroundOperatorStreamProps = {
    missionControlHost: string;
    enabled?: boolean;
};
export function useGroundOperatorStream({ missionControlHost, enabled = true }: useGroundOperatorStreamProps) {
    const [connectedDrones, setConnectedDrones] = useState<GroundOperatorStreamDrone[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<StreamError | null>(null);
    const sourceRef = useRef<EventSource | null>(null);
    const [attempt, setAttempt] = useState(0);

    const disconnect = useCallback(() => {
        sourceRef.current?.close();
        sourceRef.current = null;
        setIsConnected(false);
    }, []);

    const reconnect = useCallback(() => {
        disconnect();
        setAttempt((prev) => prev + 1);
    }, [disconnect]);

    useEffect(() => {
        if (!enabled) {
            disconnect();
            return;
        }

    const source = new EventSource(`${missionControlHost}api/ground-operator/stream`);
        sourceRef.current = source;

        const handleOpen = () => {
            setIsConnected(true);
            setError(null);
        };

        const handleMessage = (event: MessageEvent) => {
            try {
                const payload = JSON.parse(event.data) as StreamPayload;
                setConnectedDrones(payload.connectedDrones ?? []);
            } catch (err) {
                setError({
                    message: 'Failed to parse stream payload',
                    event: (err as Error).message,
                });
            }
        };

        const handleError = (event: Event) => {
            setIsConnected(false);
            setError({
                message: 'Ground operator stream connection error',
                event,
            });
        };

        source.addEventListener('open', handleOpen);
        source.addEventListener('message', handleMessage as EventListener);
        source.addEventListener('error', handleError as EventListener);

        return () => {
            source.removeEventListener('open', handleOpen);
            source.removeEventListener('message', handleMessage as EventListener);
            source.removeEventListener('error', handleError as EventListener);
            source.close();
            if (sourceRef.current === source) {
                sourceRef.current = null;
            }
            setIsConnected(false);
        };
    }, [enabled, attempt, disconnect]);

    return {
        connectedDrones,
        isConnected,
        error,
        reconnect,
        disconnect,
    };
}
