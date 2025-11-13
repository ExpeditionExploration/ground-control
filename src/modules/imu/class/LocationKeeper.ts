import { Vector3, Euler, Matrix4 } from "three";
import { SpeedKeeper } from "./SpeedKeeper";
import { TriAxisIntegrator } from "./TriAxisIntegrator";
import { IntegratorInterface } from "./IntegratorInterface";

/**
 * Keep track of current location.
 * 
 * Provides ways to update current location on speed and current timestamp.
 */
export class LocationKeeper {

    private _position: Vector3 = new Vector3(0, 0, 0);
    private _lastUpdateTimestamp: number = 0;
    private _integrator: IntegratorInterface;

    constructor(integrator: IntegratorInterface) {
        this._integrator = integrator;
    }

    public get location(): Vector3 {
        return this._position;
    }

    /**
     * Update from world acceleration, and timestamp.
     * @param speed m/s.
     * @param timestamp milliseconds of most recent measurement.
     */
    public update(
        speed: Vector3,
        timestamp: number,
    ): void {
        // Update acceleration. SpeedKeeper will translate to world coordinates,
        // and integrate.
        const deltaTime = (timestamp - this._lastUpdateTimestamp); // in ms
        this._lastUpdateTimestamp = timestamp;
        
        // update location
        this._position = this._position.add(speed.multiplyScalar(deltaTime / 1000));
    }
}