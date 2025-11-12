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

export type AccelerationCompositeProps = {
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

export function AccelerationComposite(props: AccelerationCompositeProps) {
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

        const clamp = (value: number, min: number, max: number): number => {
        return Math.min(Math.max(value, min), max);
    };

    const [compositeAccel, setCompositeAccel] = useState<Vector3>(new Vector3());
    const [compositeAccelArrow, setCompositeAccelArrow] = useState<ArrowHelper>(
        new ArrowHelper(
            compositeAccel.clone().multiplyScalar(-1).normalize(),
            new Vector3(),
            clamp(compositeAccel.length(), 0, props.settings.maxMs2 ** 2),
            0xffffff
        )
    );

    useEffect(() => {
        const newCompositeArrow = new ArrowHelper(
            compositeAccel.clone().multiplyScalar(-1).normalize(),
            new Vector3(0, 0, 0),
            clamp(compositeAccel.length(), 0, props.settings.maxMs2 ** 2),
            0xffffff
        );
        setCompositeAccelArrow(newCompositeArrow);
    }, [compositeAccel]);

    useEffect(() => {
        const xComp = new Vector3(props.acceleration.x, 0, 0);
        const yComp = new Vector3(0, props.acceleration.y, 0);
        const zComp = new Vector3(0, 0, props.acceleration.z);
        const compositeVector = xComp.add(yComp).add(zComp);
        setCompositeAccel(compositeVector);
    }, [props.acceleration]);

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
            {compositeAccel.length() > 0.1 && <primitive object={compositeAccelArrow} />}
        </mesh>
    );
}
