import { LogLevel } from "./logger";
import fs from 'node:fs/promises';
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
        try {
            let obj: string;

            if (typeof window !== "undefined") {
                // const response = await fetch(`${import.meta.env.BASE_URL}moduleConfig.json5`);
                // if (!response.ok) {
                //     throw new Error(`Failed to fetch moduleConfig.json5 (status ${response.status})`);
                // }
                // text = await response.text();
                const { default: moduleConfig } = await import("../moduleConfig.json5");
                obj = moduleConfig;
            } else {
                const file = path.resolve(process.cwd(), 'moduleConfig.json5');
                const text = await fs.readFile(file, 'utf8');
                obj = await JSON5.parse(text);
            }

            this.modules = obj;
            console.log('JSON5 module configuration loaded');
        } catch (error) {
            console.error('Error loading JSON5 module configuration:', error);
        }
    }
}