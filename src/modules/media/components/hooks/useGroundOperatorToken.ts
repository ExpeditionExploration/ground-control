import { useCallback, useState } from 'react';
import type { GroundOperatorTokenRequest } from '../schemas/ground-operator';

export type TokenSuccessResponse = {
    token: string;
    room: string;
    identity: string;
    drone: {
        id: string;
        name: string;
        macAddress: string;
        model: string;
    };
};

export type TokenErrorResponse = {
    error: string;
    details?: unknown;
};

export type missionControlHostProps = {
    missionControlHost: string;
};

export function useGroundOperatorToken({ missionControlHost }: missionControlHostProps) {
    const [data, setData] = useState<TokenSuccessResponse | null>(null);
    const [error, setError] = useState<TokenErrorResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const requestToken = useCallback(async (payload: GroundOperatorTokenRequest) => {
        if (!missionControlHost) {
            throw new Error('missionControlHost is required to request token');
        }
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`${missionControlHost}api/ground-operator/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const json = (await response.json()) as TokenSuccessResponse | TokenErrorResponse;

            if (!response.ok) {
                setData(null);
                setError(json as TokenErrorResponse);
                return { ok: false as const, data: json };
            }

            setData(json as TokenSuccessResponse);
            return { ok: true as const, data: json };
        } catch (err) {
            const fallback = { error: (err as Error).message } as TokenErrorResponse;
            setData(null);
            setError(fallback);
            return { ok: false as const, data: fallback };
        } finally {
            setIsLoading(false);
        }
    }, [missionControlHost]);

    return {
        requestToken,
        data,
        error,
        isLoading,
    };
}
