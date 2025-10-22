
import { ScanData } from '../../../tof/types';
import { TOFKeeper } from '../class/TOFKeeper';
import React, { useRef, useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { Payload } from 'src/connection';
import * as THREE from 'three';

export interface TOFProps {
    dronePosition: [number, number, number];
    droneOrientation: { yaw: number; pitch: number; roll: number };
}


export const TOFArray = (props: TOFProps) => {
    const [zones, setZones] = useState<ScanData | undefined>();
    const droneGroupRef = useRef<THREE.Group>(new THREE.Group());
    const keeperRef = useRef<TOFKeeper | null>(null);
    const { scene } = useThree();

    // Initialise keeper once
    if (!keeperRef.current) {
        keeperRef.current = new TOFKeeper(droneGroupRef.current, scene);
    }

    useEffect(() => {
        const tofChannel = new BroadcastChannel('tof-data');
        const handleMessage = (event: MessageEvent<Payload>) => {
            const payload = event.data;
            if (payload.namespace === 'tof') setZones(payload.data as ScanData);
        };
        tofChannel.addEventListener('message', handleMessage);
        return () => {
            tofChannel.removeEventListener('message', handleMessage);
            tofChannel.close();
        };
    }, []);

    // Sync proxy drone group transform with props
    useEffect(() => {
        const g = droneGroupRef.current;
        g.position.set(...props.dronePosition);
        const yaw = props.droneOrientation.yaw || 0;
        const pitch = props.droneOrientation.pitch || 0;
        const roll = props.droneOrientation.roll || 0;
        g.rotation.set(pitch, yaw, roll, 'YXZ');
    }, [props.dronePosition, props.droneOrientation]);

    useEffect(() => {
        if (zones && keeperRef.current) {
            keeperRef.current.update(zones);
        }
    }, [zones]);

    return (<></>);
};
