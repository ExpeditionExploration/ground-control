
import { Euler } from 'three';

/**
 * AccelerationKeeper converts drone accelerometer data to world woordinate system.
 */
export class AccelerationUtils {
    static droneToWorld(
        droneAcceleration: [number, number, number],
        droneOrientation: Euler,
    ): [number, number, number] {
        // Translate from drone orientation to world orientation

        // Name axes
        const [yawAxis, pitchAxis, rollAxis] = ['y', 'x', 'z'];

        // Compute acceleration in world coordinates (Y=up, -Z=forward, X=right)
        const ax = +droneAcceleration[0], ay = droneAcceleration[1], az = +droneAcceleration[2];
        const [yaw, pitch, roll] = [droneOrientation[yawAxis], droneOrientation[pitchAxis], droneOrientation[rollAxis]];
        const cy = Math.cos(yaw), sy = Math.sin(yaw);
        const cp = Math.cos(pitch), sp = Math.sin(pitch);
        const cr = Math.cos(roll), sr = Math.sin(roll);

        // Drone local to world
        const ax_w = ax * (cy * cp) + ay * (cy * sp * sr - sy * cr) + az * (cy * sp * cr + sy * sr)
        const ay_w = ax * (sy * cp) + ay * (sy * sp * sr + cy * cr) + az * (sy * sp * cr - cy * sr)
        const az_w = ax * (-sp) + ay * (cp * sr) + az * (cp * cr)

        // remap sensor axes to align with world axes
        const world: [number, number, number] = [ax_w, az_w, -ay_w]

        return world;
    }
}