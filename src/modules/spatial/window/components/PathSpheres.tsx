import {
    useState, Ref, forwardRef, useImperativeHandle, useEffect
} from 'react';
import { Sphere } from '@react-three/drei';
import { Vector3 } from 'three';
import { v4 as uuid_v4 } from 'uuid';
import { useRingBuffer } from '../hooks/useRingBuffer';

export interface PathSpheresApi {
    add: (sphere: SphereData) => void,
    getPrevious: () => [number, number, number] | null,
    getSettings: () => PathSpheresSettings,
    clear: () => void,
}
export type SphereData = {
    position: [number, number, number],
    timestamp: number,
    /**
     * UUID is optional; if not provided, it will be generated.
     */
    uuid?: string
}
export type PathSpheresApiRef = Ref<PathSpheresApi | null>;
export interface PathSpheresSettings {
    maxSpheres: number,
    sphereTravelDistanceMeters: number,
    radiusMeters: number,
}
export interface PathSpheresProps {
    settings: PathSpheresSettings,
    ref: PathSpheresApiRef,
}

export const PathSpheres = forwardRef<PathSpheresApi, PathSpheresProps>(
    ({ settings }, ref) => {
        const spheresBuffer = useRingBuffer<SphereData>(settings.maxSpheres);

        useImperativeHandle(ref, () => ({
            add: sphere => {
                const distance = new Vector3(...sphere.position).distanceTo(
                    new Vector3(...spheresBuffer.getHeadItem()?.position ?? sphere.position)
                );
                if (spheresBuffer.numItemsInBuffer() === 0 || distance >= settings.sphereTravelDistanceMeters) {
                    // Generate UUID if not provided.
                    let newSphere = sphere;
                    if (!sphere.uuid) {
                        newSphere = {
                            ...sphere,
                            uuid: uuid_v4(),
                        };
                    }
                    spheresBuffer.add(newSphere);
                }
            },

            getPrevious: (): [number, number, number] | null => {
                if (spheresBuffer.numItemsInBuffer() < 1) {
                    return null;
                }
                return spheresBuffer.getHeadItem()?.position ?? null;
            },

            clear: () => spheresBuffer.clear(),
            
            getSettings: () => settings,
        }), [settings.maxSpheres]);

        return (
            <>
                {spheresBuffer.getBuffer().map((sphereData) => (
                    <Sphere
                        key={sphereData.uuid}
                        args={[settings.radiusMeters, 8, 8]}
                        position={new Vector3(...sphereData.position)}
                    >
                        <meshStandardMaterial
                            color={0xAbbaAbba}
                        />
                    </Sphere>
                ))}
            </>
        );
    });