import {
    useState, Ref, forwardRef, useImperativeHandle, useEffect
} from 'react';
import { Sphere } from '@react-three/drei';
import { Vector3 } from 'three';
import { v4 as uuid_v4 } from 'uuid';

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
        const [spheres, setSpheres] = useState<SphereData[]>([]);

        useImperativeHandle(ref, () => ({
            add: sphere => {
                const distance = new Vector3(...sphere.position).distanceTo(
                    new Vector3(...(spheres[spheres.length - 1] ?? sphere).position)
                );
                if (spheres.length === 0 || distance >= settings.sphereTravelDistanceMeters) {
                    // Generate UUID if not provided.
                    let newSphere = sphere;
                    if (!sphere.uuid) {
                        newSphere = {
                            ...sphere,
                            uuid: uuid_v4(),
                        };
                    }
                    setSpheres(prev =>
                        [...prev, newSphere].slice(0, settings.maxSpheres)
                    );
                }
            },

            getPrevious: (): [number, number, number] | null => {
                if (spheres.length < 1) {
                    return null;
                }
                return spheres[spheres.length - 1].position;
            },

            clear: () => setSpheres([]),
            
            getSettings: () => settings,
        }), [settings.maxSpheres]);

        return (
            <>
                {spheres.map((sphereData) => (
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