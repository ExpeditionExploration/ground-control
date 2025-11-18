import { Module } from 'src/module';
import { LightingGridController } from './components/LightingGridController';
import { Side, UserInterface } from 'src/client/user-interface';
import { ClientModuleDependencies } from 'src/client/client';
import { SetLightRequest } from './types';

export class LightsModuleClient extends Module {
    userInterface: UserInterface;

    constructor(deps: ClientModuleDependencies) {
        super(deps);
        this.userInterface = deps.userInterface;
    }

    onModuleInit(): void | Promise<void> {
        this.userInterface.addFooterItem(LightingGridController, {
            side: Side.Right,
            order: -10,
        });
    }

    async setLight({command, intensity}: SetLightRequest): Promise<void> {
        this.emit<SetLightRequest>('setLight', { command, intensity });
    }
}
