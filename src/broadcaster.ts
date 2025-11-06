import { Payload } from 'src/connection';
import EventEmitter from 'events';

export type EventListener<T = any> = (data: T) => void;
/**
 * The EventBroadcaster injectable class is used to handle broadcasting of events
 * on the event emitter and on the connection
 */
export class Broadcaster {
    private readonly emitter = new EventEmitter();

    on(event: string, listener: EventListener<Payload>) {
        this.emitter.on(event, listener);
    }
    off(event: string, listener: EventListener) {
        this.emitter.off(event, listener);
    }
    emit(event: string, data: any) {
        const [namespace, eventName] = event.split(':');
        const payload: Payload = {
            event: eventName,
            namespace,
            data,
        };

        this.transmit(payload);
        this.emitLocal(payload);
    }
    /**
     * Transmits the event to the connection
     * @param event The event to transmit
     */
    private transmit(payload: Payload) {
        this.emitter.emit('__transmit__', payload);
    }

    /**
     * Emits the event locally on the event emitter
     * Useful so that other modules can listen to
     * events emitted by other modules.
     * @param event The event to emit
     */
    emitLocal(payload: Payload) {
        const namespacedEvent = `${payload.namespace}:${payload.event}`;
        this.emitter.emit(namespacedEvent, payload);

        const events = this.emitter.eventNames();

        const wildcardEventsMatchingEvent = events.filter((event: string) => {
            if (event[0] === '*') {
                const eventName = event.split(':')[1];
                if (event.split(':')[1] === '*') {
                    return true;
                }
                return eventName === payload.event;
            }

            return false;
        });

        for (const wildcardEvent of wildcardEventsMatchingEvent) {
            this.emitter.emit(wildcardEvent, payload);
        }
    }
}
