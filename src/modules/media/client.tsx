import { Module } from 'src/module';
import { Side, UserInterface } from 'src/client/user-interface';
import { ClientModuleDependencies } from 'src/client/client';
import { Room, TextStreamReader } from 'livekit-client';
import type { MediaContextValue } from './context/MediaModuleContext';
import { MediaModuleShell } from './components/MediaModuleShell';
import {
    MediaPortalTakePictureAnchor,
    MediaPortalRecordAnchor,
    MediaPortalWebCamAnchor,
} from './components/MediaPortalAnchors';

export class MediaModuleClient extends Module {
    userInterface: UserInterface;
    tokenServer: string | null;
    tokenServerRequestInterval: NodeJS.Timeout | null = null;
    token: string | null = null;
    livekitHost: string | null = null;
    livekitInterval: NodeJS.Timeout | null = null;
    encoder: TextEncoder = new TextEncoder();
    decoder: TextDecoder = new TextDecoder();
    private readonly roomName = 'mission-control-test';
    readonly liveKitRoom: Room;
    private portalTargets = new Map<string, HTMLElement>();
    private portalSubscribers = new Set<() => void>();
    private portalVersion = 0;
    private webcamControls?: MediaContextValue['webcamControls'];
    

    constructor(deps: ClientModuleDependencies) {
        super(deps);
        this.userInterface = deps.userInterface;
        this.liveKitRoom = new Room({
            adaptiveStream: true,
            dynacast: true,
        });
    }

    onModuleInit(): void | Promise<void> {
        this.userInterface.addContextItem(MediaModuleShell);
        this.userInterface.addFooterItem(MediaPortalTakePictureAnchor, {
            side: Side.Right,
        });
        this.userInterface.addFooterItem(MediaPortalRecordAnchor, {
            side: Side.Right,
        });
        this.userInterface.addFooterItem(MediaPortalWebCamAnchor, {
            side: Side.Right,
        });
    }

    registerPortalTarget(slot: string, element: HTMLElement | null) {
        const existing = this.portalTargets.get(slot);
        if (existing === element) {
            return;
        }
        if (element) {
            this.portalTargets.set(slot, element);
        } else {
            this.portalTargets.delete(slot);
        }
        this.notifyPortalSubscribers();
    }

    getPortalTarget(slot: string) {
        return this.portalTargets.get(slot);
    }

    subscribeUpdates(listener: () => void) {
        this.portalSubscribers.add(listener);
        return () => {
            this.portalSubscribers.delete(listener);
        };
    }

    getVersion() {
        return this.portalVersion;
    }

    setWebcamControls(controls: MediaContextValue['webcamControls']) {
        if (this.webcamControls === controls) {
            return;
        }
        this.webcamControls = controls;
        this.notifyPortalSubscribers();
    }

    private notifyPortalSubscribers() {
        this.portalVersion += 1;
        this.portalSubscribers.forEach((listener) => {
            listener();
        });
    }

    get mediaConfig() {
        return (this.config as any)?.modules?.media ?? {};
    }
}
