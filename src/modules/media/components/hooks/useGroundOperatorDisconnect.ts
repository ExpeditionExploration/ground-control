import { useCallback, useState } from 'react';

export type GroundOperatorDisconnectPayload = {
    macAddress: string;
};

type DisconnectSuccessResponse = {
    success: true;
    message: string;
    drone: {
        id: string;
        name: string;
        macAddress: string;
        status: 'OFFLINE' | 'ONLINE' | string;
    };
};

type DisconnectErrorResponse = {
    error: string;
    details?: unknown;
};

type useGroundOperatorDisconnectProps = {
    missionControlHost: string;
};

export function useGroundOperatorDisconnect(props: useGroundOperatorDisconnectProps) {
    const { missionControlHost } = props ?? { missionControlHost: null };
    const [data, setData] = useState<DisconnectSuccessResponse | null>(null);
    const [error, setError] = useState<DisconnectErrorResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const disconnect = useCallback(async (payload: GroundOperatorDisconnectPayload) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${missionControlHost}api/ground-operator/disconnect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
                keepalive: true,
            });

            const json = (await response.json()) as DisconnectSuccessResponse | DisconnectErrorResponse;

            if (!response.ok) {
                setData(null);
                setError(json as DisconnectErrorResponse);
                return { ok: false as const, data: json };
            }

            setData(json as DisconnectSuccessResponse);
            return { ok: true as const, data: json };
        } catch (err) {
            const fallback = { error: (err as Error).message } as DisconnectErrorResponse;
            setData(null);
            setError(fallback);
            return { ok: false as const, data: fallback };
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        disconnect,
        data,
        error,
        isLoading,
    };
}
