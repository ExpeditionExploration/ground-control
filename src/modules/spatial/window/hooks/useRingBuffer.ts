import { useRef } from 'react';

export const useRingBuffer = <T,>(size: number) => {
    const buffer = useRef<Array<T | null>>(new Array(size).fill(null));
    const head = useRef(0);
    const isFull = useRef(false);

    const add = (item: T) => {
        buffer.current[head.current] = item;
        head.current = (head.current + 1) % size;
        if (buffer.current[head.current] !== null) {
            isFull.current = true;
        }
    };

    const getBuffer = (): T[] => {
        if (!isFull.current) {
            return buffer.current.slice(0, head.current) as T[];
        }
        return [...buffer.current];
    };

    const numItemsInBuffer = (): number => {
        return isFull.current ? size : head.current;
    };

    const getHeadItem = (): T => {
        return buffer.current[head.current];
    }
    
    const clear = () => {
        buffer.current = new Array(size).fill(null);
        head.current = 0;
        isFull.current = false;
    };

    return { add, getBuffer, numItemsInBuffer, getHeadItem, clear };
}
