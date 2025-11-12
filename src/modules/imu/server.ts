import { Module } from 'src/module';
import { IMU, SensorEvent, SensorId } from './class/IMU'; // SensorEvent comes from IMU
import { Acceleration, Orientation, Speed } from './types';
import * as opengpio from 'opengpio';
import { TriAxisIntegrator } from './class/TriAxisIntegrator';
import { SpeedKeeper } from './class/SpeedKeeper';
import { Euler, Vector3 } from 'three';

export class IMUModuleServer extends Module {

    private samplingInterval = 20

    private accelerationIntegrator = new TriAxisIntegrator()
    private speedKeeper = new SpeedKeeper(
        new TriAxisIntegrator(),
        new Vector3(0, 0, -1),
        new Vector3(1, 0, 0),
        new Vector3(0, 1, 0)
    );
    private currentYpr: [number, number, number] = [0, 0, 0]
    private imu?: IMU
    private speed: [number, number, number] = [0, 0, 0]

    onModuleInit(): void | Promise<void> {
        if (!this.config.modules.imu.server.enabled) {
            return;
        }
        this.imu = new IMU(
            this.config.modules.imu.server.bno085.i2cBus,
            parseInt(this.config.modules.imu.server.bno085.i2cAddr, 16)
        );
        this.imu.open()
        this.imu.setMeasurementCallback(this.onMeasurement)
        this.imu.enableSensor(SensorId.SH2_ROTATION_VECTOR, this.samplingInterval)
        this.imu.enableSensor(SensorId.SH2_LINEAR_ACCELERATION, this.samplingInterval)
        if (this.config.modules.imu.server.bno085.useInterrupts) {
            try {
                const [className, fieldName] = this.config.modules.imu.server.bno085.interruptPin;
                const GpioClass = (opengpio as Record<string, any>)[className];
                const interruptPin = GpioClass.bcm?.[fieldName];
                this.imu.useInterrupts(`gpiochip${interruptPin.chip}`, interruptPin.line);
            } catch (error) {
                this.logger?.error?.('Failed to configure IMU interrupts', error);
            }
        }
        this.imu.devOn()
    }

    private onMeasurement = (ev: SensorEvent, cookie: Object): void => {
        switch (ev.reportId) {
            case SensorId.SH2_LINEAR_ACCELERATION:
                // Don't add delay. Timestamp is sensor's timestamp the sample
                // was taken.
                const timestamp =
                    +this.toMs(ev.timestampMicroseconds);
                
                this.speedKeeper.update(
                    [ev.x, ev.y, ev.z],
                    new Euler(...this.currentYpr, 'YXZ'),
                    timestamp,
                );
                this.logger.info('emitting speed', {
                    x: this.speedKeeper.speed.x,
                    y: this.speedKeeper.speed.y,
                    z: this.speedKeeper.speed.z,
                });
                this.emit<Speed>('speed', {
                    x: this.speedKeeper.speed.x,
                    y: this.speedKeeper.speed.y,
                    z: this.speedKeeper.speed.z,
                    timestamp,
                });

                // Compute acceleration in world coordinates (Y=up, -Z=forward, X=right)
                const ax = +ev.x, ay = +ev.y, az = +ev.z;
                const [yaw, pitch, roll] = this.currentYpr;
                const cy = Math.cos(yaw), sy = Math.sin(yaw);
                const cp = Math.cos(pitch), sp = Math.sin(pitch);
                const cr = Math.cos(roll), sr = Math.sin(roll);

                // Drone local to world
                const ax_w = ax * (cy * cp) + ay * (cy * sp * sr - sy * cr) + az * (cy * sp * cr + sy * sr)
                const ay_w = ax * (sy * cp) + ay * (sy * sp * sr + cy * cr) + az * (sy * sp * cr - cy * sr)
                const az_w = ax * (-sp) + ay * (cp * sr) + az * (cp * cr)

                // remap sensor axes to align with world axes
                const world: [number, number, number] = [ax_w, az_w, -ay_w]
                // this.logger.debug('Linear acceleration', ev)
                this.emit<Acceleration>('acceleration', world as Acceleration)

                const dv = this.accelerationIntegrator.integrate(world, timestamp)
                // Accumulate delta-v into current speed
                this.speed = [
                    this.speed[0] + dv[0],
                    this.speed[1] + dv[1],
                    this.speed[2] + dv[2],
                ]

                this.logger.info(`Total speed: ${(this.speed.reduce((a, b) => a + b * b, 0) ** 0.5).toFixed(2)} m/s`);
                // this.emit<Speed>("speed", {
                //     x: this.speed[0],
                //     y: this.speed[1],
                //     z: this.speed[2],
                //     timestamp,
                // })
                break;

            case SensorId.SH2_ROTATION_VECTOR:
                this.emit<Orientation>(
                    "orientation",
                    [ev.yaw, ev.pitch, ev.roll]
                )
                this.currentYpr = [ev.yaw, ev.pitch, ev.roll]
                break;
        }
    }

    private toMs = (us: bigint): number => {
        return Number(us / 1000n)
    }
}
