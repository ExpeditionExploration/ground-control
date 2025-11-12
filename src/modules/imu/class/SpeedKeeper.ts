import { Euler, Matrix4, Vector3 } from "three";
import { IntegratorInterface } from "./IntegratorInterface";

// SpeedKeeper keeps track of speed and its direction in given 3D space.
export class SpeedKeeper {

    private _speed: Vector3 = new Vector3(0, 0, 0);

    constructor(
        private integrator: IntegratorInterface,
        public worldforward: Vector3,
        public worldright: Vector3,
        public worldup: Vector3
    ) {}

    public getSpeedVector(): [number, number, number] {
        return [this.worldforward.x, this.worldright.y, this.worldup.z];
    }

    public update(
        newDroneAcceleration: [number, number, number],
        newDroneOrientation: Euler,
        timestamp: number,
    ): void {
        // Translate from drone orientation to world orientation
        const toWorldOrientation = new Matrix4().makeRotationFromEuler(
            newDroneOrientation
        );
        const droneWorldAccelerationVector = new Vector3(
            newDroneAcceleration[0],
            newDroneAcceleration[1],
            newDroneAcceleration[2],
        ).applyMatrix4(toWorldOrientation);

        // Integrate acceleration to get deltaV
        const [deltaVx, deltaVy, deltaVz] =
            this.integrator.integrate(droneWorldAccelerationVector.toArray(), timestamp);
        this._speed.add(new Vector3(deltaVx, deltaVy, deltaVz));
    }

    get speed(): Vector3 {
        return this._speed;
    }
}