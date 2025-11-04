import { Connection, Payload } from "src/connection";
import { Config } from "src/config";
import { Broadcaster } from "src/broadcaster";
import { ClientApplicationDependencies } from "./client";

export class ClientConnection extends Connection {
    private socket?: WebSocket;
    private readonly config!: Config;
    private readonly broadcaster!: Broadcaster;

    constructor(deps: ClientApplicationDependencies) {
        super();
        this.config = deps.config;
        this.broadcaster = deps.broadcaster;

        this.broadcaster.on('__transmit__', (payload: Payload) => this.send(payload));
    }

    async init() {
        await this.connect();
    }

    private async connect() {
        this.destroy();

        await new Promise<void>((resolve) => {
            const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
            this.socket = new WebSocket(`${proto}://${location.hostname}:${this.config.port}`);
            this.socket.onopen = () => {
                console.log('Connected to server');
                resolve()
            }
            this.socket.onclose = () => {
                console.log('Disconnected from server');
                this.reconnect();
            }
            this.socket.onerror = (error) => {
                console.error('Error connecting to server', error);
                resolve()
                this.socket?.close();
            }
            this.socket.onmessage = (message) => {
                try {
                    const payload = JSON.parse(message.data) as Payload;
                    this.broadcaster.emitLocal(payload);
                } catch (e) {
                    console.error('Error parsing message', e);
                }
            }
        });
    }

    destroy() {
        if (this.socket) {
            this.socket.onclose = null;
            this.socket.close();
        }
    }

    reconnect() {
        if (this.config.reconnectTimeout > 0) {
            console.log(`Reconnecting in ${this.config.reconnectTimeout / 1000}s`);
            setTimeout(() => this.connect(), this.config.reconnectTimeout);
        }
    }

    send(payload: Payload): void {
        // console.log('Sending payload', payload)
        this.socket?.send(JSON.stringify(payload));
    }

}

export default ClientConnection;