import { Module } from 'src/module';
import { PCA9685 } from 'openi2c';
import { ServerModuleDependencies } from 'src/server/server';
import { Payload } from 'src/connection';

export class LightsModuleServer extends Module {
    private pwmModule: PCA9685;

    private brightnessMap: { [key: string]: number } = {
        vis: 0,
        ir: 0,
        uv: 0,
    };
    private readonly numLightStates = 5;
    private readonly lightCycleMinBlockTimeout = 250; // milliseconds
    private visLightTimer: NodeJS.Timeout | null = null;
    private irLightTimer: NodeJS.Timeout | null = null;
    private uvLightTimer: NodeJS.Timeout | null = null;
    private deps: ServerModuleDependencies;

    constructor(deps: ServerModuleDependencies) {
        super(deps);
        this.deps = deps;
    }

    async onModuleInit(): Promise<void> {
        if (!this.pwmModule) {
            if (this.config.modules.lights.server.enabled && this.config.modules.common.pca9685.enabled) {
                this.pwmModule = new PCA9685(this.config.modules.common.pca9685.i2cBus, parseInt(this.config.modules.common.pca9685.i2cAddr, 16));
            }
            this.pwmModule?.init();
            this.pwmModule?.setFrequency(this.config.modules.common.pca9685.frequency);
            this.logger.info(`PCA9685 enabled: ${this.config.modules.lights.server.enabled && this.config.modules.common.pca9685.enabled}`);
        }
        this.on('setLight', ({type}) => this.cycleLight({ type }));
        this.broadcaster.on('drone-remote-control:command', (payload: Payload) => {
            switch (payload.data.command) {
                case 'infrared-led':
                    if (this.irLightTimer) {
                        this.irLightTimer.refresh();
                        return;
                    } else {
                        this.irLightTimer = setTimeout(() => {
                            this.irLightTimer = null;
                        }, this.lightCycleMinBlockTimeout);
                    }
                    this.cycleLight({ type: 'ir' })
                    .then(() => {})
                    .catch((err) => { this.logger.error('Error cycling IR light:', err); });
                    break;

                case 'visible-led':
                    if (this.visLightTimer) {
                        this.visLightTimer.refresh();
                        return;
                    } else {
                        this.visLightTimer = setTimeout(() => {
                            this.visLightTimer = null;
                        }, this.lightCycleMinBlockTimeout);
                    }
                    this.cycleLight({ type: 'vis' })
                    .then(() => {})
                    .catch((err) => { this.logger.error('Error cycling Vis light:', err); });
                    break;

                case 'ultraviolet-led':
                    if (this.uvLightTimer) {
                        this.uvLightTimer.refresh();
                        return;
                    } else {
                        this.uvLightTimer = setTimeout(() => {
                            this.uvLightTimer = null;
                        }, this.lightCycleMinBlockTimeout);
                    }
                    this.cycleLight({ type: 'uv' })
                    .then(() => {})
                    .catch((err) => { this.logger.error('Error cycling UV light:', err); });
                    break;
            }
        });
    }

    private cycleLight = async (data: { type: 'vis' | 'ir' | 'uv'; brightness?: number }) => {
        let channel: number; // Channel is PWM module output channel.
        switch (data.type) {
            case 'vis':
                channel = this.config.modules.lights.server.pca9685.leds.vis;
                break;
            case 'ir':
                channel = this.config.modules.lights.server.pca9685.leds.ir;
                break;
            case 'uv':
                channel = this.config.modules.lights.server.pca9685.leds.uv;
                break;
            default:
                this.logger.warn(`Unknown light type: ${data.type}`);
                return;
        }
        const curBrightness = this.brightnessMap[data.type] || 0;
        const decrement = 1 / (this.numLightStates - 1);
        const brightness = curBrightness - decrement < 0 ? 1 : curBrightness - decrement;
        this.brightnessMap[data.type] = brightness;
        this.logger.info(`Setting PWM channel ${channel} (${data.type}) to brightness ${brightness}`);
        if (this.pwmModule) {
            await this.pwmModule.setDutyCycle(channel, brightness);
        }
    };
}
