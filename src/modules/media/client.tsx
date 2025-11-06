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
        this.broadcaster.on('*:*', (data) => {
            if (this.liveKitRoom.state !== 'connected') {
                console.warn('LiveKit room not connected, skipping publishData');
                return;
            }
            console.log('Broadcast received in MediaModuleClient. Emitting', data);
            this.liveKitRoom.localParticipant.publishData(
                this.encoder.encode(JSON.stringify(data)),
            ).catch((error) => {
                console.error('Failed to publish data to LiveKit', error);
            });
        });
        this.liveKitRoom.registerTextStreamHandler('drone-control',
            async (reader: TextStreamReader, participant: {identity: string}) => {
                console.log('Data stream started from participant:', participant);
                console.log('Stream information:', reader.info);
                for await (const chunk of reader) {
                    try {
                        const parsed = JSON.parse(chunk);
                        console.log('Data:', parsed.droneControl);
                        const data = {
                            command: parsed.droneControl.command,
                            identity: participant.identity,
                        };
                        this.broadcaster.emit('drone-remote-control:command', data);
                    } catch (e) {
                        console.error('Failed to parse data message', e);
                    }
                }
            }
        );
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

    getMediaContextValue(): MediaContextValue {
        const mediaConfig = this.mediaConfig as {
            liveKitUrl: string;
            missionControlHost: string;
        };
        return {
            module: this,
            liveKitUrl: mediaConfig.liveKitUrl,
            missionControlHost: mediaConfig.missionControlHost,
            room: this.liveKitRoom,
            webcamControls: this.webcamControls,
        };
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
