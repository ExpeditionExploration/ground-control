import { Module } from 'src/module';
import { SpatialHeaderButton } from './components/SpatialHeaderButton';
import { UserInterface } from 'src/client/user-interface';
import { ClientModuleDependencies } from 'src/client/client';
import { Payload } from 'src/connection';
import { Orientation, Acceleration, Location } from '../imu/types';
import { AngleStatus } from './types';
import { Speed } from '../imu/types';


export class SpatialModuleClient extends Module {
    userInterface: UserInterface;
    private spatialChannel: BroadcastChannel;
    private spatialWindowSettingsInterval?: NodeJS.Timeout;

    constructor(deps: ClientModuleDependencies) {
        super(deps);
        this.userInterface = deps.userInterface;
        this.spatialChannel = new BroadcastChannel('spatial-window');
    }

    rad2deg(radians: number): number {
        return radians * (180 / Math.PI);
    }

    onModuleInit(): void | Promise<void> {
        this.userInterface.addFooterItem(SpatialHeaderButton);

        this.broadcaster.on('imu:orientation', (payload: Payload) => {
            const imuOrientation = payload.data.map(a => this.rad2deg(a)) as Orientation;
            const angleStatus: AngleStatus = {
                // TODO: Align IMU and spatial angles order
                angle: [-imuOrientation[0], -imuOrientation[2], -imuOrientation[1]],
            }
            this.sendStatusPayloadToWindow({
                event: 'orientation',
                namespace: 'angle',
                data: angleStatus,
            });
        });

        this.broadcaster.on('imu:acceleration', (payload: Payload) => {
            const imuAcceleration = payload.data as Acceleration;
            this.sendStatusPayloadToWindow({
                event: 'acceleration',
                namespace: 'acceleration',
                data: imuAcceleration,
            });
        });

        this.broadcaster.on('imu:speed', (payload: Payload) => {
            const imuSpeed = payload.data as Speed;
            this.sendStatusPayloadToWindow({
                event: 'speed',
                namespace: 'speed',
                data: imuSpeed,
            });
        });

        this.broadcaster.on('imu:location', (payload: Payload) => {
            this.logger.info('Seinding imu:location to spatial:', payload);
            const imuLocation = payload.data as Location;
            this.sendStatusPayloadToWindow({
                event: 'location',
                namespace: 'location',
                data: imuLocation,
            });
        });

        this.broadcaster.on('control:wrench', (payload: Payload) => {
            this.sendStatusPayloadToWindow(payload);
        });

        this.spatialChannel.onmessage = (message: MessageEvent<Payload>) => {
            const payload: Payload = message.data;
            switch (payload.namespace) {
                case 'spatial-window':
                    if (payload.event === 'ack') {
                        clearInterval(this.spatialWindowSettingsInterval);
                        this.logger.info(`Settings received by spatial window.
                            Cancelling send settings interval.`);
                    }
                    break;
            }
        }
    }

    sendStatusPayloadToWindow(payload: Payload) {
        // Send via BroadcastChannel instead of postMessage
        this.spatialChannel.postMessage(payload);
    }

    openWindow() {
        const windowUrl = import.meta.env.DEV
            ? '/src/modules/spatial/window/index.html'
            : '/spatial.html'; // Built filename

        window.open(windowUrl, "spatialWindow", 'width=800,height=600');
        this.logger.info("Spatial window opened; Set interval to transmit config.");
        const data = {...this.config.modules};
        this.spatialWindowSettingsInterval = setInterval(() => {
            this.sendStatusPayloadToWindow({
                event: 'settings',
                namespace: 'settings',
                data,
            });
        }, 1000);
    }

    destroy() {
        // Clean up BroadcastChannel when module is destroyed
        this.spatialChannel.close();
    }
}
