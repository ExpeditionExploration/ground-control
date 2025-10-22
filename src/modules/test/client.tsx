import { Module } from 'src/module';
import { TestButton } from './components/TestButton';
import { UserInterface } from 'src/client/user-interface';
import { ClientModuleDependencies } from 'src/client/client';
import { Payload } from 'src/connection';

export class TestModuleClient extends Module {
    userInterface: UserInterface;
    private testChannel: BroadcastChannel;

    constructor(deps: ClientModuleDependencies) {
        super(deps);
        this.userInterface = deps.userInterface;
        this.testChannel = new BroadcastChannel('test-window');
    }

    onModuleInit(): void | Promise<void> {
        console.log('Test Module Client Initialized');
        this.userInterface.addFooterItem(TestButton);
        this.broadcaster.on('control:wrenchTarget', (payload: Payload) => {
            console.log('Test Module Client forwarding wrenchTarget to test window', payload);
            this.testChannel.postMessage(payload);
        });
    }

    openWindow() {
        const windowUrl = import.meta.env.DEV
            ? '/src/modules/test/window/index.html'
            : '/test.html'; // Built filename

        window.open(windowUrl, 'testWindow', 'width=800,height=600');
    }

    destroy() {
        // Clean up BroadcastChannel when module is destroyed
        this.testChannel.close();
    }
}
