import { LogLevel } from "./logger";
// import fs from 'node:fs/promises';
import path from 'node:path';
import JSON5 from 'json5';

/**
 * The Config injectable class is used to handle configuration settings from JSON5 file
 */
export class Config {
    port = 16500;
    reconnectTimeout = 5000;
    logger: LogLevel[] | boolean = true; // Set to false to disable logging
    modules = {};

    async init() {
        // try {
        //     let text: string;

        //     if (typeof window !== "undefined") {
        //         const response = await fetch(`${import.meta.env.BASE_URL}moduleConfig.json5`);
        //         if (!response.ok) {
        //             throw new Error(`Failed to fetch moduleConfig.json5 (status ${response.status})`);
        //         }
        //         text = await response.text();
        //     } else {
        //         await import('fs/promises').then(async fs => {
        //             const file = path.resolve(process.cwd(), 'moduleConfig.json5');
        //             text = await fs.readFile(file, 'utf8');
        //         });
        //     }

        //     this.modules = JSON5.parse(text);
        //     console.log('JSON5 module configuration loaded');
        // } catch (error) {
        //     console.error('Error loading JSON5 module configuration:', error);
        // }
    }
}