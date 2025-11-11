import {
    MeshBasicMaterial,
    AxesHelper,
    Vector3,
    ArrowHelper,
    DoubleSide,
    Quaternion,
    Euler,
} from 'three';
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';

export type GizmoOverlayProps = {
    acceleration: {
        x: number;
        y: number;
        z: number;
    };
    droneOrientation: {
        yaw: number;
        pitch: number;
        roll: number;
    };
    cameraOrientation?: {
        yaw: number;
        pitch: number;
        roll: number;
        forward: [number, number, number];
    };
    settings: {
        maxMs2: number;
        maxArrowLength: number;
        cameraDistance: number;
    };
};

export function GizmoOverlay(props: GizmoOverlayProps) {
    const hudHalfWidth = 1.6;
    const hudHalfHeight = 1.0;
    const margin = 0.25;
    const overlayPosition: [number, number, number] = [
        hudHalfWidth - margin,
        hudHalfHeight - margin,
        0,
    ];
    const [axisMaterials] = useState<MeshBasicMaterial[]>(
        [new MeshBasicMaterial({ color: "#ff0000" }), // red
        new MeshBasicMaterial({ color: "#00ff00" }), // green
        new MeshBasicMaterial({ color: "#0000ff" })]); // blue
    const [barColors] = useState<number[]>(
        [0xff5555, 0x55ff55, 0x5599ff]); // r, g, b
    const [triad] =
        useState<AxesHelper>(new AxesHelper(props.settings.maxArrowLength));

    // Normalize accelerations to be between 0 and maxMs2
    const accelArrowLen = (accel: number) => {
        const maxAccel = props.settings.maxMs2;
        const clampedAccel = clamp(accel, 0.01, maxAccel);
        const factor = clamp(clampedAccel / maxAccel, 0, 1);
        const arrowLength = factor * props.settings.maxArrowLength;
        return arrowLength;
    };

    const [xAccel, setXAccel] = useState<number>(0);
    const [yAccel, setYAccel] = useState<number>(0);
    const [zAccel, setZAccel] = useState<number>(0);
    const [xAccelArrow, setXAccelArrow] = useState<ArrowHelper>(new ArrowHelper(
        new Vector3(1, 0, 0).normalize(),
        new Vector3(0, 0, 0),
        xAccel,
        barColors[0],
    ));
    const [yAccelArrow, setYAccelArrow] = useState<ArrowHelper>(new ArrowHelper(
        new Vector3(0, 1, 0).normalize(),
        new Vector3(0, 0, 0),
        yAccel,
        barColors[1],
    ));
    const [zAccelArrow, setZAccelArrow] = useState<ArrowHelper>(new ArrowHelper(
        new Vector3(0, 0, 1).normalize(),
        new Vector3(0, 0, 0),
        zAccel,
        barColors[2],
    ));

    useEffect(() => {
        setXAccel(accelArrowLen(props.acceleration.x));
        setYAccel(accelArrowLen(props.acceleration.y));
        setZAccel(accelArrowLen(props.acceleration.z));
    }, [props.acceleration]);

    const clamp = (value: number, min: number, max: number): number => {
        return Math.min(Math.max(value, min), max);
    };

    useEffect(() => {
        const headLen = 0.4;
        const headWidth = 0.2;
        const xAccelArrowParams: [number, number, number] = [
            clamp(xAccel, 0, props.settings.maxMs2),
            headLen, headWidth
        ];
        const yAccelArrowParams: [number, number, number] = [
            clamp(yAccel, 0, props.settings.maxMs2),
            headLen, headWidth
        ];
        const zAccelArrowParams: [number, number, number] = [
            clamp(zAccel, 0, props.settings.maxMs2),
            headLen, headWidth
        ];
        xAccelArrow.setLength(...xAccelArrowParams);
        yAccelArrow.setLength(...yAccelArrowParams);
        zAccelArrow.setLength(...zAccelArrowParams);
        setXAccelArrow(xAccelArrow);
        setYAccelArrow(yAccelArrow);
        setZAccelArrow(zAccelArrow);
    }, [xAccel, yAccel, zAccel]);

    const deg2rad = (degrees: number): number => {
        return degrees * (Math.PI / 180);
    };

    const [triadState, setTriadState] = useState<{
        yaw: number;
        pitch: number;
        roll: number;
        triadCameraPosition: Vector3;
    }>({
        yaw: 0,
        pitch: 0,
        roll: 0,
        triadCameraPosition: new Vector3(),
    });

    useEffect(() => {
        if (!props.cameraOrientation || !props.droneOrientation) {
            console.log(`Missing orientations:`, props.cameraOrientation, props.droneOrientation)
        };

        const droneYPR = new Euler(
            // Match TOFArray: rotation.set(pitch, yaw, roll, 'YXZ')
            deg2rad(props.droneOrientation.pitch),
            deg2rad(props.droneOrientation.yaw),
            deg2rad(props.droneOrientation.roll),
            "YXZ"
        );

        const cameraYPR = new Euler(
            props.cameraOrientation.yaw,
            props.cameraOrientation.pitch,
            props.cameraOrientation.roll,
            "YXZ"
        );

        const cameraForwardReverse = new Vector3(
            -props.cameraOrientation.forward[0],
            -props.cameraOrientation.forward[1],
            -props.cameraOrientation.forward[2],
        ).normalize().multiplyScalar(props.settings.cameraDistance);

        const newCameraPosition = new Vector3().add(cameraForwardReverse);

        setTriadState({
            yaw: droneYPR.y,
            pitch: droneYPR.x,
            roll: droneYPR.z,
            triadCameraPosition: newCameraPosition,
        });
    }, [props.droneOrientation, props.cameraOrientation]);

    const three = useThree();

    useEffect(() => {
        if (!three || !props.cameraOrientation) return;
        const cam = three.camera;
        // Copy orientation from main view camera (already radians, order YXZ)
        const e = new Euler(
            props.cameraOrientation.pitch,
            props.cameraOrientation.yaw,
            props.cameraOrientation.roll,
            'YXZ'
        );
        cam.quaternion.setFromEuler(e);
        // Keep manual position along reversed forward
        cam.position.set(
            triadState.triadCameraPosition.x,
            triadState.triadCameraPosition.y,
            triadState.triadCameraPosition.z
        );
        cam.updateMatrixWorld();
    }, [triadState.triadCameraPosition, props.cameraOrientation]);

    return (
        <mesh position={[0,0,0]} rotation={[
            // x=pitch, y=yaw, z=roll to align with 'YXZ' construction
            triadState.pitch,
            triadState.yaw,
            triadState.roll
        ]}>
            <primitive object={triad} />
            {xAccel > 0.1 && <primitive object={xAccelArrow} />}
            {yAccel > 0.1 && <primitive object={yAccelArrow} />}
            {zAccel > 0.1 && <primitive object={zAccelArrow} />}
        </mesh>
    );
}
