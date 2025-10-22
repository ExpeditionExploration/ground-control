import './index.css';
import { useEffect, useState, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Text, Billboard, MapControls } from '@react-three/drei';
import { Line } from '@react-three/drei';
import { Bloom, EffectComposer, N8AO } from '@react-three/postprocessing';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MeshStandardMaterial, Mesh, Color, EllipseCurve } from 'three';
import { KernelSize } from 'postprocessing';
import { Wrench as ControlWrench } from 'src/modules/control/types';
import { Payload } from 'src/connection';
import { AngleStatus } from '../types';
import { TOFArray } from './components/TOFArray';

const TEXT_SCALE = 0.15;
const LINE_HEIGHT = TEXT_SCALE * 1.25;
const LINE_WIDTH = 0.003;

const roundToTenths = (value: number) => Math.round(value * 10) / 10;
const roundOrientation = (orientation: AngleStatus['angle']) => orientation.map(roundToTenths) as AngleStatus['angle'];

interface DroneProps {
    position: [number, number, number];
    controlWrench: ControlWrench;
    angleStatus: AngleStatus;
    settings: any;
}

function Drone(props: DroneProps) {
    const obj = useLoader(OBJLoader, './drone.obj');
    const { controlWrench, angleStatus } = props;

    useEffect(() => {
        // Apply MeshStandardMaterial to all meshes in the loaded object
        const material = new MeshStandardMaterial({
            color: '#888888',
            metalness: 0.3,
            roughness: 0.4,
        });

        obj.traverse((child) => {
            if ((child as Mesh).isMesh) {
                (child as Mesh).material = material;
            }
        });
    }, [obj]);

    const ellipseArcPoints = (
        horizontalD: number,
        verticalD: number,
        endAngle: number,
        plane: 'XY' | 'ZY' | 'ZX' = 'XY',
        rotation: number = 0,
        clockwise: boolean = false,
        depth: number = 0.001,
        centerX: number = 0,
        centerY: number = 0,
    ) => {
        const curve = new EllipseCurve(
            centerX,  centerY,
            horizontalD / 2, verticalD / 2,
            0,  endAngle, // start and end angle.
            clockwise,
            rotation
        );
        const points = curve.getPoints(72);
        switch (plane) {
            case 'XY':
                return points;
            case 'ZY':
                return points.map(p => [depth, p.y, p.x] as [number, number, number]);
            case 'ZX':
                return points.map(p => [p.y, depth, p.x] as [number, number, number]);
        }
    }

    const arcPoints = (
        horizontalOffset: number,
        verticalOffset: number,
        depthOffset: number,
        plane: 'XY' | 'ZY' | 'ZX' = 'XY',
        rotation: number = 0,
        radius: number = 0.72,
    ) => {
        const R = radius;
        const steps = 72;

        // Center chosen so circle passes through endpoints
        const dY = Math.sqrt(R * R - horizontalOffset * horizontalOffset);
        const centerY = verticalOffset + dY;

        const beta = Math.atan2(verticalOffset - centerY, horizontalOffset);
        const startAngle = Math.PI - beta + rotation;
        const endAngle = beta + rotation;

        const pts: [number, number, number][] = [];
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const angle = startAngle + (endAngle - startAngle) * t;
            const x = Math.cos(angle) * R;
            const y = Math.sin(angle) * R + centerY;
            switch (plane) {
                case 'XY':
                    pts.push([x, y, depthOffset]);
                    break;
                case 'ZY':
                    pts.push([depthOffset, y, x]);
                    break;
                case 'ZX':
                    pts.push([y, depthOffset, x]);
                    break;
            }
        }
        return pts;
    }

    const locs = props.settings?.spatial.client.uiMarkers;
    const rollArcPoints = useMemo(() => {
        const motorOffsetX = 0.7;        // fixed endpoint X
        const endpointY = 0.5;           // fixed endpoint Y
        const pts = arcPoints(motorOffsetX, endpointY, 0.001);
        return pts;
    }, []);

    const yawArcPoints = useMemo(() => {
        const horiz = 1.5;
        const vert = 1.5;
        const depth = 0.001;
        const points = ellipseArcPoints(horiz, vert, Math.PI * 0.6, 'ZX', 1.2 * Math.PI);
        return points;
    }, [locs]);

    const pitchArcPoints = useMemo(() => {
        const horiz = 1.5;
        const vert = 1.5;
        const points = ellipseArcPoints(horiz, vert, Math.PI * 3/5, 'ZY', Math.PI + 1/5 * Math.PI);
        return points;
    }, [locs]);

    return (
    <group scale={[0.1, 0.1, 0.1]} position={props.position} rotation={[angleStatus.angle[0] * (Math.PI / 180), angleStatus.angle[1] * (Math.PI / 180), angleStatus.angle[2] * (Math.PI / 180)]}>
            <primitive
                rotation={[0, 0, 0]}
                scale={[0.1, 0.1, 0.1]}
                object={obj}
            />
            {locs &&
            <group position={[0, 0, 0]}>
                <Billboard
                    follow={true}
                    lockX={false}
                    lockY={false}
                    lockZ={false}
                    position={locs.surgeBillboard}
                >
                    <Text
                        fontSize={TEXT_SCALE * 1}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        <meshStandardMaterial
                            color="#ffffff"
                            emissive="#00ffff"
                            emissiveIntensity={1}
                            toneMapped={false}
                        />
                        Surge
                    </Text>
                    <Text
                        position={[0, -LINE_HEIGHT, 0]}
                        fontSize={TEXT_SCALE * 0.75}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        <meshStandardMaterial
                            color="#ffffff"
                            emissive="#00ffff"
                            emissiveIntensity={1}
                            toneMapped={false}
                        />
                        Power: {(controlWrench.surge * 100).toFixed(0)}%
                    </Text>
                </Billboard>
                <Line
                    points={[
                        locs.surgeBillboard.map((a, i) => i === 1 ? a + 0.2 : a),
                        locs.surgeBillboard.map((a, i) => i === 1 ? a + 0.5 : a),
                    ]}
                    color="#ffffff"
                    transparent={true}
                    opacity={0.25}
                    lineWidth={LINE_WIDTH}
                    worldUnits={true}
                />
            </group> }
            {locs &&
            <group position={locs.yawBillboard}>
                <Billboard
                    position={[-1, 0, 0]}
                    follow={true}
                    lockX={false}
                    lockY={false}
                    lockZ={false}
                >
                    <Text
                        position={[0, 0, 0]}
                        fontSize={TEXT_SCALE * 1}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        <meshStandardMaterial
                            color="#ffffff"
                            emissive="#00ffff"
                            emissiveIntensity={1}
                            toneMapped={false}
                        />
                        Yaw
                    </Text>
                    <Text
                        position={[0, -LINE_HEIGHT, 0]}
                        fontSize={TEXT_SCALE * 0.75}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        <meshStandardMaterial
                            color="#ffffff"
                            emissive="#00ffff"
                            emissiveIntensity={1}
                            toneMapped={false}
                        />
                        Power: {(controlWrench.yaw * 100).toFixed(0)}%
                    </Text>
                </Billboard>

                <group position={[0, 0, 0]}>
                    <Line
                        points={yawArcPoints}
                        color="#ffffff"
                        transparent={true}
                        opacity={0.25}
                        lineWidth={LINE_WIDTH}
                        worldUnits={true}
                    />
                </group>
            </group> }
            {locs &&
            <group position={[0, 0, 0]}>
                <Billboard
                    position={locs.rollBillboard}
                    follow
                    lockX={false}
                    lockY={false}
                    lockZ={false}
                >
                    <Text
                        fontSize={TEXT_SCALE * 1}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        <meshStandardMaterial
                            color="#ffffff"
                            emissive="#00ffff"
                            emissiveIntensity={1}
                            toneMapped={false}
                        />
                        Roll
                    </Text>
                    <Text
                        position={locs.rollBillboard.map((a, i) => i === 1 ? -LINE_HEIGHT : a)}
                        fontSize={TEXT_SCALE * 0.75}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        <meshStandardMaterial
                            color="#ffffff"
                            emissive="#00ffff"
                            emissiveIntensity={1}
                            toneMapped={false}
                        />
                        Power: {(controlWrench.roll * 100).toFixed(0)}%
                    </Text>
                </Billboard>
                {/* Semi-circle arc with endpoints at x = -0.7 and 0.7 (motor centers) */}
                <Line
                    points={rollArcPoints}
                    color="#ffffff"
                    transparent
                    opacity={0.6}
                    lineWidth={LINE_WIDTH}
                    worldUnits
                />
                {/* Left endpoint downward arrow. */}
                <Line
                    points={[
                        [-0.76, 0.5, 0.001],
                        [-0.7, 0.42, 0.001],
                    ]}
                    color="#ffffff"
                    transparent
                    opacity={0.85}
                    lineWidth={LINE_WIDTH}
                    worldUnits
                />
                <Line
                    points={[
                        [-0.64, 0.5, 0.001],
                        [-0.7, 0.42, 0.001],
                    ]}
                    color="#ffffff"
                    transparent
                    opacity={0.85}
                    lineWidth={LINE_WIDTH}
                    worldUnits
                />
            </group> }
            { locs &&
            <group position={locs.pitchBillboard}>
                <Billboard
                    position={[0, -0.3, 0]}
                    follow={true}
                    lockX={false}
                    lockY={false}
                    lockZ={false}
                >
                    <Text
                        position={[0, -0.7, 0]}
                        fontSize={TEXT_SCALE * 1}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        <meshStandardMaterial
                            color="#ffffff"
                            emissive="#00ffff"
                            emissiveIntensity={1}
                            toneMapped={false}
                        />
                        Pitch
                    </Text>
                    <Text
                        position={[0, -0.7 - LINE_HEIGHT, 0]}
                        fontSize={TEXT_SCALE * 0.75}
                        color="#ffffff"
                        anchorX="center"
                        anchorY="middle"
                    >
                        <meshStandardMaterial
                            color="#ffffff"
                            emissive="#00ffff"
                            emissiveIntensity={1}
                            toneMapped={false}
                        />
                        Power: {(controlWrench.pitch * 100).toFixed(0)}%
                    </Text>
                </Billboard>

                <group position={[0, 0, 0]}>
                    <Line
                        points={pitchArcPoints}
                        color="#ffffff"
                        transparent={true}
                        opacity={0.25}
                        lineWidth={LINE_WIDTH}
                        worldUnits={true}
                    />
                </group>
            </group> }
        </group>
    );
}
export function App() {
    const [dronePosition, setDronePosition] = useState<[number, number, number]>([0, 0, 0]);
    const [controlWrench, setControlWrench] = useState<ControlWrench>({ heave: 0, sway: 0, surge: 0, yaw: 0, pitch: 0, roll: 0 });
    const [angleStatus, setAngleStatus] = useState<AngleStatus>({ angle: [0, 0, 0] });
    const [settings, setSettings] = useState<Object | null>(null);

    useEffect(() => {
        const spatialChannel = new BroadcastChannel('spatial-window');
        const handleMessage = (event: MessageEvent<Payload>) => {
            const payload = event.data;

            switch (payload.namespace) {
                case 'location':
                    if (Array.isArray(payload.data?.position)) {
                        setDronePosition(payload.data.position as [number, number, number]);
                    }
                    break;
                case 'control':
                    setControlWrench(payload.data as ControlWrench);
                    break;
                case 'angle':
                    setAngleStatus((prev) => {
                        const next = payload.data as AngleStatus;
                        const roundedNextAngles = roundOrientation(next.angle);
                        const roundedPrevAngles = roundOrientation(prev.angle);
                        const anglesChanged = roundedNextAngles.some((value, index) => value !== roundedPrevAngles[index]);
                        return anglesChanged ? next : prev;
                    });
                    break;
                case 'settings':
                    console.log("Received settings:", payload);
                    setSettings(payload.data);
                    const pl: Payload = {
                        event: 'ack',
                        namespace: 'spatial-window',
                        data: 'Settings received',
                    }
                    spatialChannel.postMessage(pl);
                    break;
            }
        };
        spatialChannel.addEventListener('message', handleMessage);
        return () => {
            spatialChannel.removeEventListener('message', handleMessage);
            spatialChannel.close();
        };
    }, []);

    useEffect(() => {
        console.log('Settings updated:', settings);
    }, [settings]);

    const deg2rad = (deg: number) => deg * (Math.PI / 180);

    return (
        <div className="bg-gray-900 bg-gradient-to-t from-gray-950 min-h-screen">
            <Canvas camera={{ position: [1, 2, 3], fov: 30 }} frameloop="demand">
                <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    target={dronePosition}
                />
                <ambientLight color={'#0b4f4a'} intensity={10} />
                <pointLight
                    color={'#0b4f4a'}
                    position={[0, 100000, 0]}
                    decay={0}
                    intensity={60}
                />
                <pointLight
                    color={'#0f172b'}
                    position={[0, -100000, 0]}
                    decay={0}
                    intensity={20}
                />
                <Drone position={dronePosition} controlWrench={controlWrench} angleStatus={angleStatus} settings={settings} />
                <TOFArray dronePosition={dronePosition} droneOrientation={{ yaw: deg2rad(angleStatus.angle[1]), pitch: deg2rad(angleStatus.angle[0]), roll: deg2rad(angleStatus.angle[2]) }} />
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
        </div>
    );
}
