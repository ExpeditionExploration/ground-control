import { Module } from 'src/module';
import { PCA9685 } from 'openi2c';
import { ServerModuleDependencies } from 'src/server/server';
import { Payload } from 'src/connection';
import { LightStatusUpdate, SetLightRequest } from './types';

export class LightsModuleServer extends Module {
    private pwmModule: PCA9685;
    private deps: ServerModuleDependencies;

    constructor(deps: ServerModuleDependencies) {
        super(deps);
        this.deps = deps;
    }

    async onModuleInit(): Promise<void> {
        if (!this.pwmModule && this.config.modules.lights.server.enabled && this.config.modules.common.pca9685.enabled) {
            this.pwmModule = new PCA9685(this.config.modules.common.pca9685.i2cBus, parseInt(this.config.modules.common.pca9685.i2cAddr, 16));
            this.pwmModule.init();
            this.pwmModule.setFrequency(this.config.modules.common.pca9685.frequency);
            this.logger.info('PCA9685 initialized');
            
            // Set all lights to 0 brightness on init
            await this.pwmModule.setDutyCycle(this.config.modules.lights.server.pca9685.leds.vis, 0);
            await this.pwmModule.setDutyCycle(this.config.modules.lights.server.pca9685.leds.ir, 0);
            await this.pwmModule.setDutyCycle(this.config.modules.lights.server.pca9685.leds.uv, 0);
            this.logger.info('All lights initialized to 0% brightness');
        }
        this.on('setLight', (data) => {
            this.logger.debug('Received setLight command:', data);
            this.setLight(data).catch((err) => {
                this.logger.error('Error setting light:', err);
            });
        });
        this.broadcaster.on('livekit:data', (payload: Payload) => {
            this.logger.debug('Received LiveKit data payload:', payload);
            const command = payload.data.command;
            const intensity = payload.data.intensity;
            this.logger.info(`Received light command from LiveKit: ${command} with intensity ${intensity}`);
            switch (command) {
                case 'visible-led':
                    this.setLight({command, intensity})
                    .then(() => {})
                    .catch((err) => { this.logger.error('Error setting visible light:', err); });
                    break;
                case 'ultraviolet-led':
                    this.setLight({command, intensity})
                    .then(() => {})
                    .catch((err) => { this.logger.error('Error setting ultraviolet light:', err); });
                    break;
                case 'infrared-led':
                    this.setLight({command, intensity})
                    .then(() => {})
                    .catch((err) => { this.logger.error('Error setting infrared light:', err); });
                    break;
                default:
                    this.logger.warn(`Unknown light command from LiveKit: ${command}`);
                    break;
            }
        });
    }

    private setLight = async (data: SetLightRequest) => {
        if (!this.pwmModule) {
            this.logger.warn('PWM module not initialized, cannot set light');
            return;
        }

        this.logger.info(`Setting ${data.command} light to brightness ${data.intensity}`);
        let channel: number; // Channel is PWM module output channel.
        switch (data.command) {
            case 'visible-led':
                channel = this.config.modules.lights.server.pca9685.leds.vis;
                break;
            case 'infrared-led':
                channel = this.config.modules.lights.server.pca9685.leds.ir;
                break;
            case 'ultraviolet-led':
                channel = this.config.modules.lights.server.pca9685.leds.uv;
                break;
            default:
                this.logger.warn(`Unknown light type: ${data.command}`);
                return;
        }
        await this.pwmModule.setDutyCycle(channel, data.intensity);
        
        // All emits already get published from media module to LiveKit
        this.emit<LightStatusUpdate>('lightStatus', {
            command: data.command,
            intensity: data.intensity,
        });
        
        // Broadcast light state change to remote operators via LiveKit
        // this.broadcaster.emit('livekit:publish', {
        //     event: 'lights:state',
        //     command: data.command,
        //     intensity: data.intensity
        // });
    }

    // private cycleLight = async (data: { type: 'vis' | 'ir' | 'uv'; brightness?: number }) => {
    //     let channel: number; // Channel is PWM module output channel.
    //     switch (data.type) {
    //         case 'vis':
    //             channel = this.config.modules.lights.server.pca9685.leds.vis;
    //             break;
    //         case 'ir':
    //             channel = this.config.modules.lights.server.pca9685.leds.ir;
    //             break;
    //         case 'uv':
    //             channel = this.config.modules.lights.server.pca9685.leds.uv;
    //             break;
    //         default:
    //             this.logger.warn(`Unknown light type: ${data.type}`);
    //             return;
    //     }
    //     if (data.brightness) {
    //         await this.pwmModule.setDutyCycle(channel, data.brightness);
    //         this.emit<LightStatusUpdate>('lightStatus', {
    //             type: data.type,
    //             brightness: data.brightness,
    //         });
    //         return;
    //     }
    //     const curBrightness = this.brightnessMap[data.type] || 0;
    //     const decrement = 1 / (this.numLightStates - 1);
    //     const brightness = curBrightness - decrement < 0 ? 1 : curBrightness - decrement;
    //     this.brightnessMap[data.type] = brightness;
    //     this.logger.info(`Setting PWM channel ${channel} (${data.type}) to brightness ${brightness}`);
    //     if (this.pwmModule) {
    //         await this.pwmModule.setDutyCycle(channel, brightness);
    //         this.emit<LightStatusUpdate>('lightStatus', {
    //             type: data.type,
    //             brightness: brightness,
    //         });
    //     }
        
    //     // Broadcast light state change to remote operators via LiveKit
    //     this.broadcaster.emit('livekit:publish', {
    //         event: 'lights:state',
    //         type: data.type,
    //         brightness: brightness
    //     });
    // };
        
}
