import { Orientation } from '../imu/types';

export type Stats = {
    temperature: number;
    cpu: number;
    memory: number;
    storage: number;
}

export type AngleStatus = {
    angle: Orientation
}