import { Connection, Payload } from "src/connection";
import { Config } from "src/config";
import { Broadcaster } from "src/broadcaster";
import SimplePeer from 'simple-peer';
import { ClientApplicationDependencies } from "./client";

export class ClientConnection extends Connection {
    private socket?: WebSocket;
    private readonly config!: Config;
    private readonly broadcaster!: Broadcaster;
    private peer?: SimplePeer.Instance;

    constructor(deps: ClientApplicationDependencies) {
        super();
        this.config = deps.config;
        this.broadcaster = deps.broadcaster;
        this.broadcaster.on('__transmit__', (payload: Payload) => this.send(payload));
    }

    async init() {
        // await this.connect();
        await this.createPeer();
    }

    private async createPeer() {
        console.log('Creating peer connection');
        const peer = new SimplePeer({
            initiator: true,
            trickle: false
        })

        peer.on('error', err => console.log('error', err))

        peer.on('signal', data => {
            fetch(`http://${location.hostname}:16500/offer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }).then(res => res.json()).then((answer: SimplePeer.SignalData) => {
                peer.signal(answer);
            });
        });

        peer.on('connect', () => {
            peer.send('whatever' + Math.random())
        })

        peer.on('data', data => {
            console.log('data: ' + data)
        });

        this.peer = peer;
    }

    private async connect() {
        this.destroy();

        await new Promise<void>((resolve) => {
            this.socket = new WebSocket(`ws://${location.hostname}:${this.config.port}`);
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

        if (this.peer?.connected)
            this.peer?.send(JSON.stringify(payload));
        // console.log('Sending payload', payload)
        // if(this.socket?.readyState === WebSocket.OPEN){
        //     this.socket.send(JSON.stringify(payload));
        // }else{
        //     console.warn('Socket not open, cannot send payload', payload);
        // }
    }

}

export default ClientConnection;