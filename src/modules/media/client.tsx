import { Module } from 'src/module';
import { Side, UserInterface } from 'src/client/user-interface';
import { ClientModuleDependencies } from 'src/client/client';
import { MediaContextItem } from './components/MediaContextItem';
import { TakePictureButton } from './components/TakePictureButton';
import { RecordButton } from './components/RecordButton';

export class MediaModuleClient extends Module {
    userInterface: UserInterface;
    tokenServer: string | null = null;
    tokenServerRequestInterval: NodeJS.Timeout | null = null;
    token: string | null = null;
    livekitHost: string | null = null;
    livekitInterval: NodeJS.Timeout | null = null;
    private lastTestStreamRequest = 0;
    private readonly roomName = 'mission-control-test';


    constructor(deps: ClientModuleDependencies) {
        super(deps);
        this.userInterface = deps.userInterface;
    }

    onModuleInit(): void | Promise<void> {
        this.userInterface.addContextItem(MediaContextItem);
        this.userInterface.addFooterItem(TakePictureButton, {
            side: Side.Right,
        });
        this.userInterface.addFooterItem(RecordButton, {
            side: Side.Right,
        });
    }
}
