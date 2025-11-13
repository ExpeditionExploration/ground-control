import { Euler, Matrix4, Vector3 } from "three";
import { IntegratorInterface } from "./IntegratorInterface";

// SpeedKeeper keeps track of speed and its direction in given 3D space.
export class SpeedKeeper {

    private _speed: Vector3 = new Vector3(0, 0, 0);

    constructor(
        private integrator: IntegratorInterface,
    ) {}

    /**
     * Update from world acceleration and timestamp.
     * @param newWorldAcceleration 
     * @param timestamp 
     */
    public update(
        newWorldAcceleration: [number, number, number],
        timestamp: number,
    ): void {
        // Integrate acceleration to get deltaV
        const [deltaVx, deltaVy, deltaVz] =
            this.integrator.integrate(newWorldAcceleration, timestamp);
        this._speed.add(new Vector3(deltaVx, deltaVy, deltaVz));
    }

    get speed(): Vector3 {
        return this._speed;
    }
}