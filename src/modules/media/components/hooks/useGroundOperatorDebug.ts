import { useCallback, useEffect, useState } from 'react';

export type GroundOperatorDebugDrone = {
    id: string;
    name: string;
    macAddress: string;
    clerkOrgId: string;
    connectedAt: string;
    lastOnlineAt: string;
};

type DebugSuccessResponse = {
    timestamp: string;
    totalConnected: number;
    drones: GroundOperatorDebugDrone[];
};

type DebugErrorResponse = {
    error: string;
    message?: string;
};

export type GroundOperatorDebugProps = {
    missionControlHost: string;
};
export function useGroundOperatorDebug(props: GroundOperatorDebugProps) {
    const { missionControlHost } = props ?? { missionControlHost: null };
    const [data, setData] = useState<DebugSuccessResponse | null>(null);
    const [error, setError] = useState<DebugErrorResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${missionControlHost}api/ground-operator/debug`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-store',
                },
            });

            const json = (await response.json()) as DebugSuccessResponse | DebugErrorResponse;

            if (!response.ok) {
                setData(null);
                setError(json as DebugErrorResponse);
                return { ok: false as const, data: json };
            }

            setData(json as DebugSuccessResponse);
            return { ok: true as const, data: json };
        } catch (err) {
            const fallback = { error: (err as Error).message } as DebugErrorResponse;
            setData(null);
            setError(fallback);
            return { ok: false as const, data: fallback };
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        data,
        error,
        isLoading,
        refresh,
    };
}
