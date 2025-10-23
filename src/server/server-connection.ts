import { Config } from "src/config";
import { Connection, Payload } from "src/connection";
import { WebSocketServer } from 'ws';
import handler from 'serve-handler';
import http, { Server } from 'http';
import { Broadcaster } from "src/broadcaster";
import { ServerApplicationDependencies } from "./server";
import Fastify from 'fastify'
import cors from '@fastify/cors'
import SimplePeer from 'simple-peer';
import wrtc from 'wrtc';


export class ServerConnection extends Connection {
    private readonly config!: Config;
    private readonly broadcaster!: Broadcaster;
    private webSocketServer?: WebSocketServer;
    private server?: Server;
    private peer?: SimplePeer.Instance;
    private signal?: Promise<SimplePeer.SignalData>;

    constructor(deps: ServerApplicationDependencies) {
        super();
        this.config = deps.config;
        this.broadcaster = deps.broadcaster;
    }

    async init() {
        await this.createPeer();
        await this.createServer();
        this.broadcaster.on('__transmit__', (payload: Payload) => this.send(payload));

    }

    async createServer() {
        const fastify = Fastify({
            logger: true
        })
        await fastify.register(cors, {
            origin: true
        })

        // Declare a route
        fastify.post('/offer', async (request) => {
            const offer = request.body as SimplePeer.SignalData;
            console.log('Received offer from client', offer);
            this.peer!.signal(offer);
            const signal = await this.signal!;
            return signal;
        });

        try {
            await fastify.listen({ port: 16500 })
            console.log('Fastify server listening on port 16500');
        } catch (err) {
            fastify.log.error(err)
            process.exit(1)
        }
    }

    async createPeer() {
        // Server does not create peer connections
        const peer = new SimplePeer({ wrtc });
        peer.on('data', data => {
            // got a data channel message
            console.log('got a message from peer1: ' + data);
            peer.send('pong');
        })
        this.peer = peer;
        this.signal = new Promise<SimplePeer.SignalData>((resolve) => {
            peer.on('signal', data => resolve(data))
        });
    }

    destroy() {
        this.peer?.destroy();
        this.server?.close();
    }

    send(payload: Payload) {
        if (this.peer?.connected)
            this.peer?.send(JSON.stringify(payload));
    }
}