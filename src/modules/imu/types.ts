export type Acceleration = [number, number, number]

export type Orientation = [number, number, number]

/**
 * Speed in meters per second in world coordinate system
 */
export interface Speed {
    x: number,
    y: number,
    z: number,
    timestamp: number,
}

export type Location = [number, number, number]