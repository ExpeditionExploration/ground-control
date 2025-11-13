import {
    AxesHelper,
    Vector3,
    ArrowHelper,
    Euler,
} from 'three';
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { maxTransformDependencies } from 'mathjs';

export type SpeedCompositeProps = {
    speed: Vector3, // in m/s
    speedTimestamp: number,
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
        maxMs: number;
        maxArrowLength: number;
        cameraDistance: number;
    };
};

export function SpeedComposite(props: SpeedCompositeProps) {
    const [speedColor, setSpeedColor] = useState<number>(
        0xffa500);
    const [triad] =
        useState<AxesHelper>(new AxesHelper(props.settings.maxArrowLength));

    // Normalize speeds to be between 0 and maxMs
    const speedArrowLen = (speed: number) => {
        const maxSpeed = props.settings.maxMs;
        const clampedSpeed = clamp(speed, 0.01, maxSpeed);
        const factor = clamp(clampedSpeed / maxSpeed, 0, 1);
        const arrowLength = factor * props.settings.maxArrowLength;
        return arrowLength;
    };
        const clamp = (value: number, min: number, max: number): number => {
        return Math.min(Math.max(value, min), max);
    };

    const [compositeSpeed, setCompositeSpeed] = useState<Vector3>(new Vector3());
    const [compositeSpeedArrow, setCompositeSpeedArrow] = useState<ArrowHelper>(
        new ArrowHelper(
            compositeSpeed.clone().multiplyScalar(-1).normalize(),
            new Vector3(),
            compositeSpeed.length(),
            speedColor,
        )
    );

    // Update the arrow helper's position and direction.
    useEffect(() => {
        compositeSpeedArrow.setDirection(compositeSpeed.clone().multiplyScalar(-1).normalize());
        compositeSpeedArrow.setLength(compositeSpeed.length());
    }, [compositeSpeed]);

    // Clamp input speed, normalize it and fit it to max arrow length.
    useEffect(() => {
        const speed = props.speed;
        const maxSpeed = props.settings.maxMs;
        const clampedTotalSpeed = clamp(speed.length(), 0.01, props.settings.maxMs);
        const arrowLength = (clampedTotalSpeed / maxSpeed) * props.settings.maxArrowLength;
        const unitSpeedVec = speed.clone().normalize();
        const speedVecForArrow = unitSpeedVec.clone().multiplyScalar(arrowLength);
        setCompositeSpeed(speedVecForArrow);
    }, [props.speed]);

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
            return;
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
            {compositeSpeedArrow && <primitive object={compositeSpeedArrow} />}
        </mesh>
    );
}
