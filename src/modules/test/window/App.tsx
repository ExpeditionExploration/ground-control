import './index.css';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, Torus, Grid } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { Color, Vector3 } from 'three';
import { KernelSize } from 'postprocessing';
import { Physics, RigidBody, CuboidCollider, RapierRigidBody } from '@react-three/rapier';
import { Suspense, useEffect, useRef } from 'react';

function Drone() {
    const obj = useLoader(OBJLoader, './drone.obj');
    const bodyRef = useRef<RapierRigidBody>(null);

    // // We'll use useFrame to apply a continuous force
    // useFrame(() => {
    //     if (!bodyRef.current) {
    //         return;
    //     }

    //     // 1. Define the force and the point in the drone's local space
    //     const force = new Vector3(0, 0.0000001, 0); // Upward force
    //     const localPoint = new Vector3(0, 0, 1); // A point 1 unit in front of the drone's center

    //     // 2. Get the drone's current world position and rotation
    //     const worldPosition = bodyRef.current.translation();
    //     const worldRotation = bodyRef.current.rotation();

    //     // 3. Transform the local point to a world-space point
    //     const worldPoint = localPoint.clone().applyQuaternion(worldRotation).add(worldPosition);

    //     // 4. Apply the force at the calculated world-space point
    //     bodyRef.current.addForceAtPoint(force, worldPoint, true);
    // });

    useEffect(() => {
        if (bodyRef.current) {
            // Apply an initial upward impulse to the drone
            // bodyRef.current.applyImpulse({ x: 0, y: 0.1, z: 0 }, true);
        }
    },[]);

    return (
        <RigidBody
            ref={bodyRef}
            colliders={'hull'}
            canSleep={false}
            gravityScale={0} // Added gravity for a clearer effect
            linearDamping={0.5}
            angularDamping={0.5}
        >
            <group scale={[1, 1, 1]}>
                <primitive object={obj} scale={[0.01, 0.01, 0.01]} />
            </group>
        </RigidBody>
    );
}
export function App() {
    return (
        <Canvas camera={{ position: [1, 2, -3], fov: 20 }}>
            <Suspense>
                <Physics debug={true}>
                    <Drone />

                    <CuboidCollider
                        position={[0, -1, 0]}
                        args={[10, 0.5, 10]}
                    />
                </Physics>
            </Suspense>
            {/* <Drone /> */}
            <Grid cellSize={0.25} /> 
            <ambientLight color={'#ffffff'} intensity={1} />
            <pointLight
                color={'#ffffff'}
                position={[0, 100000, 0]}
                decay={0}
                intensity={1}
            />
            <pointLight
                color={'#ffffff'}
                position={[0, -100000, 0]}
                decay={0}
                intensity={1}
            />
            {/* 25cm Cell - 1m Grid */}
            <OrbitControls
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                target={[0, 0, 0]}
            />
            <EffectComposer>
                <N8AO
                    aoRadius={500}
                    distanceFalloff={0.5}
                    aoSamples={64}
                    intensity={10}
                    quality="high"
                    screenSpaceRadius={true}
                    halfRes={true}
                    color={new Color(0, 0, 0)}
                />
                <Bloom
                    luminanceThreshold={0.5}
                    luminanceSmoothing={0.9}
                    kernelSize={KernelSize.HUGE}
                    intensity={0.1}
                />
            </EffectComposer>
        </Canvas>
        // <div className="bg-gray-900 bg-gradient-to-t from-gray-950 min-h-screen">
        //     <Canvas
        //         camera={{ position: [50, 100, 150], fov: 30 }}
        //         frameloop="demand"
        //     >
        //         <OrbitControls
        //             enablePan={true}
        //             enableZoom={true}
        //             enableRotate={true}
        //             target={[0, 0, 0]}
        //         />
        //         <ambientLight color={'#0b4f4a'} intensity={1} />
        //         <pointLight
        //             color={'#0b4f4a'}
        //             position={[0, 100000, 0]}
        //             decay={0}
        //             intensity={20}
        //         />
        //         <pointLight
        //             color={'#0f172b'}
        //             position={[0, -100000, 0]}
        //             decay={0}
        //             intensity={20}
        //         />
        //         <Drone />
        //         <EffectComposer>
        //             <N8AO
        //                 aoRadius={500}
        //                 distanceFalloff={0.5}
        //                 aoSamples={64}
        //                 intensity={10}
        //                 quality="high"
        //                 screenSpaceRadius={true}
        //                 halfRes={true}
        //                 color={new Color(0, 0, 0)}
        //             />
        //             <Bloom
        //                 luminanceThreshold={0.5}
        //                 luminanceSmoothing={0.9}
        //                 kernelSize={KernelSize.HUGE}
        //                 intensity={0.1}
        //             />
        //         </EffectComposer>
        //     </Canvas>
        // </div>
    );
}
