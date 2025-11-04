import { useCallback, useEffect, useState } from 'react';
import type { ConnectedGroundOperatorDrone } from '../schemas/ground-operator';

type ConnectedSuccessResponse = {
    connectedDrones: ConnectedGroundOperatorDrone[];
};

type ConnectedErrorResponse = {
    error: string;
};

export type GroundOperatorConnectedProps = {
    missionControlHost?: string;
};
export function useGroundOperatorConnected(props: GroundOperatorConnectedProps) {
    const { missionControlHost } = props ?? {missionControlHost: null};
    const [data, setData] = useState<ConnectedSuccessResponse | null>(null);
    const [error, setError] = useState<ConnectedErrorResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        if (!missionControlHost) {
            setIsLoading(false);
            return { ok: false as const, data: { error: 'Mission Control host is not defined' } as ConnectedErrorResponse };
        }
        try {
            const response = await fetch(`${missionControlHost}api/ground-operator/connected`, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-store',
                },
            });

            const json = (await response.json()) as ConnectedSuccessResponse | ConnectedErrorResponse;

            if (!response.ok) {
                setData(null);
                setError(json as ConnectedErrorResponse);
                return { ok: false as const, data: json };
            }

            setData(json as ConnectedSuccessResponse);
            return { ok: true as const, data: json };
        } catch (err) {
            const fallback = { error: (err as Error).message } as ConnectedErrorResponse;
            setData(null);
            setError(fallback);
            return { ok: false as const, data: fallback };
        } finally {
            setIsLoading(false);
        }
    }, [missionControlHost]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    return {
        data,
        error,
        isLoading,
        refresh,
        connectedDrones: data?.connectedDrones ?? [],
    };
}
