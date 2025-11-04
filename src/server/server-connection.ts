import { Config } from "src/config";
import { Connection, Payload } from "src/connection";
import { WebSocketServer } from 'ws';
import handler from 'serve-handler';
import https, { Server } from 'https';
import { Broadcaster } from "src/broadcaster";
import { ServerApplicationDependencies } from "./server";
import fs from 'fs';

export class ServerConnection extends Connection {
    private readonly config!: Config;
    private readonly broadcaster!: Broadcaster;
    private webSocketServer?: WebSocketServer;
    private server?: Server;

    constructor(deps: ServerApplicationDependencies) {
        super();
        this.config = deps.config;
        this.broadcaster = deps.broadcaster;
    }

    async init() {
        const options = {
            key: fs.readFileSync(this.config.common.websocket.sslKey),
            cert: fs.readFileSync(this.config.common.websocket.sslCert),
        };
        this.server = https.createServer(options,
            (request, response) => {
            return handler(request, response, {
                public: process.cwd() // In final deployment, this should be the path to the build directory
            });
        });

        const ws = new WebSocketServer({
            server: this.server,
        });
        ws.on('connection', (socket) => {
            socket.on('message', (message) => {
                try {
                    const payload = JSON.parse(message.toString()) as Payload;
                    this.broadcaster.emitLocal(payload);
                } catch (e) {
                    console.error('Error parsing message', e);
                }
            })
        })

        this.webSocketServer = ws;

        await new Promise<void>((resolve) => this.server?.listen(this.config.port, () => {
            console.log(`Server started on port ${this.config.port}`);
            resolve();
        }));

        this.broadcaster.on('__transmit__', (payload: Payload) => this.send(payload));
    }

    destroy() {
        this.webSocketServer?.close();
        this.server?.close();
    }

    send(payload: Payload) {
        this.webSocketServer?.clients.forEach(client => {
            client.send(JSON.stringify(payload));
        });
    }
}