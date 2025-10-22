import { Module } from 'src/module';
import { ServerModuleDependencies } from 'src/server/server';
import { MotorState } from './class/MotorState';
import { ECMMotorState } from './class/ECMMotorState';
import { Wrench } from './types';
// import { OrangePi_5 } from 'opengpio';
import { cross, subtract, pi, sin, cos, multiply, pinv, transpose, round } from 'mathjs';
// import { PCA9685 } from 'openi2c';

const isProd = false; // process.env.NODE_ENV === 'production';
export class ControlModuleServer extends Module {
    private pwmModule: any;
    private physicalMotors: { [key: string]: MotorState } = {};
    private virtualMotors: { [key: string]: MotorState } = {};
    private virtualToPhysical: { [physicalKey: string]: { [virtualKey: string]: number } } = {};

    constructor(deps: ServerModuleDependencies) {
        super(deps);
    }

    onModuleInit(): void | Promise<void> {
        // if (!this.pwmModule) {
        //     if (this.config.modules.control.server.enabled && this.config.modules.common.pca9685.enabled) {
        //         this.pwmModule = new PCA9685(this.config.modules.common.pca9685.i2cBus, parseInt(this.config.modules.common.pca9685.i2cAddr, 16));
        //     }
        //     this.pwmModule?.init();
        //     this.pwmModule?.setFrequency(this.config.modules.common.pca9685.frequency);
        //     this.logger.info(`PCA9685 enabled: ${this.config.modules.control.server.enabled && this.config.modules.common.pca9685.enabled}`);
        // }
        for (const [name, motor] of Object.entries(this.config.modules.common.motors)) {
            this.physicalMotors[name] = new ECMMotorState({
                name: `${name} Motor`,
                logger: this.logger,
                pwmModule: this.pwmModule,
                gpioOutPWM: motor.gpioOutPWM,
                gpioOutReverse: motor.gpioOutReverse,
                gpioOutStop: motor.gpioOutStop,
                invertPWM: motor.invertPWM,
                invertRotationDirection: motor.invertRotationDirection,
                scale: motor.scale,
                position: motor.position,
                orientation: motor.orientation,
            });
        }
        this.virtualMotors = {
            heave: new MotorState({
                logger: this.logger,
                name: 'Heave Motors',
            }),
            sway: new MotorState({
                logger: this.logger,
                name: 'Sway Motors',
            }),
            surge: new MotorState({
                name: 'Surge Motors',
                logger: this.logger,
            }),
            yaw: new MotorState({
                name: 'Yaw Motors',
                logger: this.logger,
            }),
            pitch: new MotorState({
                name: 'Pitch Motors',
                logger: this.logger,
            }),
            roll: new MotorState({
                logger: this.logger,
                name: 'Roll Motors',
            }),
        };
        this.setupMotors();
        this.emitWrenchContinuously();
    }

    emitWrenchContinuously() {
        setInterval(() => {
            const wrench: Wrench = {
                heave: this.virtualMotors.heave.power,
                sway: this.virtualMotors.sway.power,
                surge: this.virtualMotors.surge.power,
                yaw: this.virtualMotors.yaw.power,
                pitch: this.virtualMotors.pitch.power,
                roll: this.virtualMotors.roll.power,
            };
            this.emit('wrench', wrench);
        }, 250);
    }

    async setupMotors() {
        const virtual = Object.values(this.virtualMotors);
        const physical = Object.values(this.physicalMotors);
        const { heave, sway, surge, yaw, pitch, roll } = this.virtualMotors;

        // Initialize virtual and physical motors
        await Promise.all(virtual.map((m) => m.init()));
        await Promise.all(physical.map((m) => m.init()));

        // Compute linear mapping from virtual motors to physical motors
        let mappingMatrix = [];
        for (const motor of physical) {
            let position = motor?.position ?? [0, 0, 0];
            let orientation = motor?.orientation ?? [0, 0, 0];
            // Round to 2 decimals but keep values as numbers to satisfy the expected types
            position = subtract(position, this.config.modules.common.drone.centerOfMass) as number[];
            let force = orientation;
            let torque = cross(position, orientation);
            this.logger.info(`${motor.name} position: ${round(position, 2)}, orientation: ${round(orientation, 2)}, force: ${round(force, 2)}, torque: ${round(torque, 2)}`);
            /*mappingMatrix.push([
                force[0],  // sway
                force[1],  // heave
                force[2],  // surge
                torque[0], // pitch
                torque[1], // yaw
                torque[2], // roll
            ]);*/
            mappingMatrix.push([ // Change coordinate system from 3D viewer to Mission Control
                force[1],  // heave
                force[0],  // sway
                force[2],  // surge
                torque[1], // yaw
                torque[0], // pitch
                torque[2], // roll
            ]);
        }
        mappingMatrix = transpose(mappingMatrix);
        this.logger.info(`Mapping matrix: ${JSON.stringify(round(mappingMatrix, 2))}`);
        let inverseMappingMatrix = pinv(mappingMatrix); // To be recomputed if motors change: stuck or broken
        this.logger.info(`Moore-Penrose-inverted mapping matrix: ${JSON.stringify(round(inverseMappingMatrix, 2))}`);
        this.virtualToPhysical = {};
        const virtualKeys = Object.keys(this.virtualMotors);
        const physicalKeys = Object.keys(this.physicalMotors);
        for (let i = 0; i < physicalKeys.length; i++) {
            const physKey = physicalKeys[i];
            this.virtualToPhysical[physKey] = {};
            for (let j = 0; j < virtualKeys.length; j++) {
                const virtKey = virtualKeys[j];
                this.virtualToPhysical[physKey][virtKey] = inverseMappingMatrix[i][j];
            }
        }
        this.logger.info(`Virtual to physical mapping: ${JSON.stringify(this.virtualToPhysical)}`);

        for (const motor of virtual) {
            motor.on('setPower', (power) => {
                this.logger.info(`${motor.name} power set to ${power}`);
            });
        }

        this.on('wrenchTarget', (wrench: Wrench) => {
            // Update virtual motors for telemetry/UX
            heave.setPower(wrench.heave);
            sway.setPower(wrench.sway);
            surge.setPower(wrench.surge);
            yaw.setPower(wrench.yaw);
            pitch.setPower(wrench.pitch);
            roll.setPower(wrench.roll);

            // Linearly combine each virtual motor power into each physical motor
            for (const [physicalKey, terms] of Object.entries(this.virtualToPhysical)) {
                let sum = 0;
                for (const [virtualKey, scale] of Object.entries(terms)) {
                    sum += (wrench[virtualKey as keyof Wrench]) * scale;
                }
                this.physicalMotors[physicalKey].setPower(sum);
                this.logger.info(`${this.physicalMotors[physicalKey].name} power set to ${sum}`);
            }

            this.logger.debug(`Wrench command received`, this.physicalMotors);
        });
    }
}
