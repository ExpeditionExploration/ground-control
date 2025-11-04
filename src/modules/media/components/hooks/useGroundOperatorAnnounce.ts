import { useState, useCallback } from 'react';
import type { GroundOperatorAnnounce } from '../schemas/ground-operator';

type AnnounceSuccessResponse = {
    success: true;
    message: string;
    drone: {
        id: string;
        name: string;
        macAddress: string;
        status: 'ONLINE' | 'OFFLINE' | string;
    };
    missionId: string;
};

type AnnounceErrorResponse = {
    error: string;
    details?: unknown;
    expected?: string;
    received?: string;
};
type useGroundOperatorAnnounceProps = {
    missionControlHost: string;
};
export function useGroundOperatorAnnounce(props: useGroundOperatorAnnounceProps) {
    const [data, setData] = useState<AnnounceSuccessResponse | null>(null);
    const [error, setError] = useState<AnnounceErrorResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const announce = useCallback(async (payload: GroundOperatorAnnounce) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${props.missionControlHost}api/ground-operator/announce`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const json = (await response.json()) as AnnounceSuccessResponse | AnnounceErrorResponse;

            if (!response.ok) {
                setData(null);
                setError(json as AnnounceErrorResponse);
                return { ok: false as const, data: json };
            }

            setData(json as AnnounceSuccessResponse);
            return { ok: true as const, data: json };
        } catch (err) {
            const fallback = { error: (err as Error).message } as AnnounceErrorResponse;
            setData(null);
            setError(fallback);
            return { ok: false as const, data: fallback };
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        announce,
        data,
        error,
        isLoading,
    };
}
