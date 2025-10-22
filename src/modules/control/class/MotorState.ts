import EventEmitter from 'events';
import { Logger } from 'src/logger';
// import { PCA9685 } from 'openi2c';

export class MotorState extends EventEmitter {
    logger: Logger;
    name: string;
    rampSpeed: number; // Ramp speed for power transitions
    position: number[]; // Relative position of the motor
    orientation: number[]; // Relative orientation of the motor
    scale: number; // Scale factor for the motor
    power: number = 0; // Power level for the motor, typically between -100 and 100
    protected targetPower: number = 0; // Target power level for the motor, used for smooth transitions
    protected pwmModule: any;

    constructor({
        name,
        logger,
        pwmModule: pwmModule,
        rampSpeed: rampSpeed,
        position: position,
        orientation: orientation,
        scale: scale,
    }: {
        name: string;
        logger: Logger;
        pwmModule?: any;
        rampSpeed?: number;
        position?: number[];
        orientation?: number[];
        scale?: number;
    }) {
        super();
        this.name = name;
        this.logger = logger;
        this.pwmModule = pwmModule;
        this.rampSpeed = rampSpeed || 0.5; // Default speed for the motor
        this.position = position || [0, 0, 0];
        this.orientation = orientation || [0, 0, 0];
        this.scale = scale || 1;
    }

    async init() {
        this.logger.info(`Initializing ${this.name}`);
        setInterval(() => {
            if (this.targetPower !== this.power) {
                // Smoothly transition to the target power level
                const step = (this.targetPower - this.power) * this.rampSpeed;
                this.power += step;
                if (Math.abs(this.targetPower - this.power) < 0.01) {
                    this.power = this.targetPower; // Snap to target if close enough
                }
                this.emit('setPower', this.power);
            }
        }, 100);
    }

    protected powerTimeout?: NodeJS.Timeout;

    setPower(power: number) {
        const clamped = Math.max(-1, Math.min(1, power*this.scale));
        this.targetPower = clamped;
        
        // Clear existing timeout
        if (this.powerTimeout) {
            clearTimeout(this.powerTimeout);
        }
        
        // Set timeout to reset power to 0 only if target is not 0
        if (this.targetPower !== 0) {
            this.powerTimeout = setTimeout(() => {
                this.targetPower = 0;
            }, 60000);
        }
    }
}
