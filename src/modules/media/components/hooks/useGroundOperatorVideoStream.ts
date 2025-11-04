import { useCallback, useState } from 'react';

export type StartVideoStreamPayload = {
    mac: string;
};

type VideoStreamSuccessResponse = {
    message: string;
    pid: number | null;
    code: number | null;
    url: string;
};

type VideoStreamErrorResponse = {
    message?: string;
    error?: string;
};

type missionControlHostProps = {
    missionControlHost: string;
};

export function useGroundOperatorVideoStream({ missionControlHost }: missionControlHostProps) {
    const [data, setData] = useState<VideoStreamSuccessResponse | null>(null);
    const [error, setError] = useState<VideoStreamErrorResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const startVideoStream = useCallback(async (payload: StartVideoStreamPayload) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${missionControlHost}api/ground-operator/stream`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const json = (await response.json()) as VideoStreamSuccessResponse | VideoStreamErrorResponse;

            if (!response.ok) {
                setData(null);
                setError(json as VideoStreamErrorResponse);
                return { ok: false as const, data: json };
            }

            setData(json as VideoStreamSuccessResponse);
            return { ok: true as const, data: json };
        } catch (err) {
            const fallback = { message: (err as Error).message } as VideoStreamErrorResponse;
            setData(null);
            setError(fallback);
            return { ok: false as const, data: fallback };
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        startVideoStream,
        data,
        error,
        isLoading,
    };
}
