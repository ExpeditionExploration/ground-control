import { Module } from 'src/module';
import { ChildProcess, spawn, spawnSync } from 'child_process';

export class MediaModuleServer extends Module {
    private testStreamProcess: ChildProcess | null = null;
    private environmentVariablesNotSet = {};
    // In case of a missing necessary environment variable or some other
    // unrecoverable error.
    private streamingFailedUnrecoverably = false;

    private roomName = "drone-room";
    private identity = `drone-${Math.floor(Math.random() * 10000)}`;
    private token: string | null = null;

    async onModuleInit() {
        this.on('takePicture', () => {
            this.logger.info('Take picture command received');
            this.takePicture();
        });
        this.on('startRecording', () => {
            this.logger.info('Start recording command received');
            // Here you would implement the logic to start recording
            // For example, you could use GStreamer to start a video stream
        });
        this.on('request-env-var', (varName: string) => {
            switch (varName) {
                case 'TOKEN_SERVER':
                    if (process.env.TOKEN_SERVER) {
                        this.logger.info("Emitting TOKEN_SERVER:", process.env.TOKEN_SERVER);
                        this.emit('response-env-var-token-server', process.env.TOKEN_SERVER);
                    } else {
                        if (this.environmentVariablesNotSet['TOKEN_SERVER'] === true) {
                            return;
                        }
                        this.environmentVariablesNotSet['TOKEN_SERVER'] = true;
                        this.logger.error("TOKEN_SERVER environment variable is not set");
                    }
                    break;
                case 'LIVEKIT_URL':
                    if (process.env.LIVEKIT_URL) {
                        this.logger.info("Emitting LIVEKIT_URL:", process.env.LIVEKIT_URL);
                        this.emit('response-env-var-livekit-url', process.env.LIVEKIT_URL);
                    } else {
                        if (this.environmentVariablesNotSet['LIVEKIT_URL'] === true) {
                            return;
                        }
                        this.environmentVariablesNotSet['LIVEKIT_URL'] = true;
                        this.logger.error("LIVEKIT_URL environment variable is not set");
                    }
                    break;
                default:
                    this.logger.warn(`Unknown environment variable requested: ${varName}`);
            }
        });

        const token = await this.requestToken();
        this.token = token;
        this.startLiveKitTestStream();
    }

    async requestToken(): Promise<string | null> {
        const res = await fetch(`${process.env.TOKEN_SERVER}/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                room: this.roomName,
                identity: this.identity,
            }),
        });
        if (!res.ok) {
            this.logger.error('Failed to fetch token:', res.statusText);
            return null;
        }
        const data = await res.json();
        return data.token || null;
    }

    takePicture(): void {
        // this.logger.info('Taking picture...');
        this.logger.error("Not implemented: takePicture()");
        return;
    }

    createMediaServer(): void {
        this.startLiveKitTestStream();
    }

    private startLiveKitTestStream() {
        if (
            this.testStreamProcess &&
            this.testStreamProcess.exitCode === null &&
            !this.testStreamProcess.killed
        ) {
            this.logger.warn('LiveKit test stream already running');
            return;
        }

        const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
        this.environmentVariablesNotSet['LIVEKIT_URL'] = process.env.LIVEKIT_URL ?? true;
        this.environmentVariablesNotSet['LIVEKIT_API_KEY'] = process.env.LIVEKIT_API_KEY ?? true;
        this.environmentVariablesNotSet['LIVEKIT_API_SECRET'] = process.env.LIVEKIT_API_SECRET ?? true;
        if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
            if (this.streamingFailedUnrecoverably === true) {
                // Already logged these errors.
                return;
            }
            this.streamingFailedUnrecoverably = true;
            this.logger.error(`Can't stream because one or more LiveKit environment variables are missing.`);
            this.logger.error(`LIVEKIT_URL: ${LIVEKIT_URL ? 'set' : 'not set'}`);
            this.logger.error(`LIVEKIT_API_KEY: ${LIVEKIT_API_KEY ? 'set' : 'not set'}`);
            this.logger.error(`LIVEKIT_API_SECRET: ${LIVEKIT_API_SECRET ? 'set' : 'not set'}`);
            return;
        }

        let cliUrl: string;
        try {
            const parsed = new URL(LIVEKIT_URL);
            if (parsed.protocol === 'wss:') {
                parsed.protocol = 'https:';
            } else if (parsed.protocol === 'ws:') {
                parsed.protocol = 'http:';
            }
            cliUrl = parsed.toString();
        } catch (error) {
            this.logger.error('Invalid LIVEKIT_URL value', error);
            return;
        }

        const args = [
            '--token', this.token,
            '--url', process.env.LIVEKIT_URL ?? '',
            '--',
            'v4l2src', 'device=/dev/video0',
            '!', 'image/jpeg,width=1920,height=1080,framerate=30/1',
            '!', 'jpegdec',
            '!', 'videoconvert',
            '!', 'x264enc', 'tune=zerolatency', 'key-int-max=60', 'bitrate=2500', 'speed-preset=ultrafast',
        ];

        const logArgs = args.map((value, index, array) => {
            const prev = array[index - 1];
            if (prev === '--api-secret' || prev === '--api-key') {
                return '***';
            }
            return value;
        });
        this.logger.info('Starting LiveKit stream');
        this.testStreamProcess = spawn('gstreamer-publisher', args, {
            env: {
                ...process.env,
                PATH: process.env.PATH,
            },
            stdio: 'pipe',
        });

        this.testStreamProcess.stdout?.on('data', (data: Buffer) => {
            this.logger.info(`gstreamer-publish stdout: ${data.toString()}`);
        });
        this.testStreamProcess.stderr?.on('data', (data: Buffer) => {
            this.logger.error(`gstreamer-publish stderr: ${data.toString()}`);
        });
        this.testStreamProcess.on('close', (code: number) => {
            this.logger.info(`gstreamer-publish exited with code ${code}`);
            this.testStreamProcess = null;
        });
        this.testStreamProcess.on('error', (error: Error) => {
            this.logger.error('Failed to start gstreamer-publish:', error);
            this.testStreamProcess = null;
        });
    }
}
