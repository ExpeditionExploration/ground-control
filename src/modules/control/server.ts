import { Module } from 'src/module';
import { ServerModuleDependencies } from 'src/server/server';
import { MotorState } from './class/MotorState';
import { ECMMotorState } from './class/ECMMotorState';
import { Wrench } from './types';
// import { OrangePi_5 } from 'opengpio';
import { cross, subtract, pi, sin, cos, multiply, pinv, transpose, round } from 'mathjs';
import { PCA9685 } from 'openi2c';
import { Payload } from 'src/connection';

const isProd = false; // process.env.NODE_ENV === 'production';
export class ControlModuleServer extends Module {
    private pwmModule: PCA9685;
    private physicalMotors: { [key: string]: MotorState } = {};
    private virtualMotors: { [key: string]: MotorState } = {};
    private virtualToPhysical: { [physicalKey: string]: { [virtualKey: string]: number } } = {};

    private previousGroundControlInput: number = 0;
    private keyDownTimers: Record<string, NodeJS.Timeout> = {};
    private remoteCommandStates: Record<string, boolean> = {
        'pitch_up': false,
        'pitch_down': false,
        'roll_left': false,
        'roll_right': false,
        'yaw_left': false,
        'yaw_right': false,
        'surge_forward': false,
        'surge_back': false,
        'heave_up': false,
        'heave_down': false,
        'visible-led': false,
        'infrared-led': false,
        'ultraviolet-led': false,
    };
    private remoteWrench: Wrench = { heave: 0, sway: 0, surge: 0, yaw: 0, pitch: 0, roll: 0 };
    private localWrench: Wrench = { heave: 0, sway: 0, surge: 0, yaw: 0, pitch: 0, roll: 0 };
    private groundControlInputTimeoutMs = 1000;

    constructor(deps: ServerModuleDependencies) {
        super(deps);
    }

    onModuleInit(): void | Promise<void> {
        if (!this.pwmModule) {
            if (this.config.modules.control.server.enabled && this.config.modules.common.pca9685.enabled) {
                this.pwmModule = new PCA9685(this.config.modules.common.pca9685.i2cBus, parseInt(this.config.modules.common.pca9685.i2cAddr, 16));
            }
            this.pwmModule?.init();
            this.pwmModule?.setFrequency(this.config.modules.common.pca9685.frequency);
            this.logger.info(`PCA9685 enabled: ${this.config.modules.control.server.enabled && this.config.modules.common.pca9685.enabled}`);
        }
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
        // this.emitWrenchContinuously();

        this.broadcaster.on('*:*', (data: Payload) => {
            if (data.namespace !== 'drone-remote-control') {
                return;
            }
            const command = data.data.command as keyof typeof this.remoteCommandStates | undefined;
            if (!command || !(command in this.remoteCommandStates)) {
                return;
            }
            this.applyRemoteCommand(command, true);
            if (this.keyDownTimers[command]) {
                clearTimeout(this.keyDownTimers[command]);
                this.keyDownTimers[command] = null;
            }
            this.keyDownTimers[command] = setTimeout(() => {
                this.logger.info(`Remote command keyup timeout for command: ${command}`);
                this.applyRemoteCommand(command, false);
            }, 60);
        });
    }

    private applyRemoteCommand(command: keyof typeof this.remoteCommandStates, active: boolean) {
        this.remoteCommandStates[command] = active;
        this.remoteWrench = {
            heave: 0,
            sway: 0,
            surge: this.computeAxis(this.remoteCommandStates.surge_back, this.remoteCommandStates.surge),
            yaw: this.computeAxis(this.remoteCommandStates.yaw_left, this.remoteCommandStates.yaw_right),
            pitch: this.computeAxis(this.remoteCommandStates.pitch_down, this.remoteCommandStates.pitch_up),
            roll: this.computeAxis(this.remoteCommandStates.roll_left, this.remoteCommandStates.roll_right),
        };
    }

    private computeAxis(negative: boolean, positive: boolean) {
        if (negative && positive) return 0;
        if (positive) return 1;
        if (negative) return -1;
        return 0;
    }

    emitWrenchContinuously() {
        setInterval(() => {
            const now = Date.now();
            const useLocal = now - this.previousGroundControlInput < this.groundControlInputTimeoutMs;
            const source = useLocal ? this.localWrench : this.remoteWrench;
            this.applyWrenchToMotors(source);
        }, 100);
    }

    async setupMotors() {
    const virtual = Object.values(this.virtualMotors);
    const physical = Object.values(this.physicalMotors);

        // Initialize virtual and physical motors
        //await Promise.all(virtual.map((m) => m.init()));
        //await Promise.all(physical.map((m) => m.init()));

        // Compute linear mapping from virtual motors to physical motors
        let mappingMatrix = [];
        for (const motor of physical) {
            let position = motor?.position ?? [0, 0, 0];
            let orientation = motor?.orientation ?? [0, 0, 0];
            // Round to 2 decimals but keep values as numbers to satisfy the expected types
            position = subtract(position, this.config.modules.common.drone.centerOfMass) as number[];
            let force = orientation;
            let torque = cross(position, orientation);
            // this.logger.info(`${motor.name} position: ${round(position, 2)}, orientation: ${round(orientation, 2)}, force: ${round(force, 2)}, torque: ${round(torque, 2)}`);
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
        mappingMatrix = [ // Simplify 5-motor configuration (for initial testing)
            [1, 1, -1, -1, 0],
            [0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1],
            [1, -1, 1, -1, 0],
            [1, 1, 1, 1, 0],
            [-1, 1, 1, -1, 0],
        ];
        // let inverseMappingMatrix = pinv(mappingMatrix); // To be recomputed if motors change: stuck or broken
        let inverseMappingMatrix = transpose(mappingMatrix); // Simplify 5-motor configuration (for initial testing)
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
                if (motor.name === 'Rear Motor') {
                    // this.logger.info(`${motor.name} power set to ${power}`);
                }
            });
        }

        this.on('wrenchTarget', (wrench: Wrench) => {
            this.previousGroundControlInput = Date.now();
            this.localWrench = { ...wrench };
            this.applyWrenchToMotors(wrench);
        });
    }

    private applyWrenchToMotors(wrench: Wrench) {
        const { heave, sway, surge, yaw, pitch, roll } = this.virtualMotors;
        heave.setPower(wrench.heave);
        sway.setPower(wrench.sway);
        surge.setPower(wrench.surge);
        yaw.setPower(wrench.yaw);
        pitch.setPower(wrench.pitch);
        roll.setPower(wrench.roll);
        this.logger.info(`Virtual power set to [${wrench.heave}, ${wrench.sway}, ${wrench.surge}, ${wrench.yaw}, ${wrench.pitch}, ${wrench.roll}]`);

        for (const [physicalKey, terms] of Object.entries(this.virtualToPhysical)) {
            let sum = 0;
            for (const [virtualKey, scale] of Object.entries(terms)) {
                sum += (wrench[virtualKey as keyof Wrench]) * scale;
            }
            this.physicalMotors[physicalKey].setPower(sum);
            // this.logger.info(`${this.physicalMotors[physicalKey].name} power set to ${sum}`);
        }

        this.emit('wrench', wrench);
    }
}
