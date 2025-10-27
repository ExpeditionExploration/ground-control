import { ApplicationDependencies } from "./container";
import { ModuleDependencies } from "./module-loader";

export enum LogLevel {
    Info = 'info',
    Warn = 'warn',
    Error = 'error',
    Debug = 'debug',
}

export class Logger {
    private logLevels: LogLevel[];
    private namespace: string;

    constructor(deps: ModuleDependencies) {
        this.namespace = deps.namespace;
        this.logLevels = typeof deps.config.logger === 'boolean' ? [LogLevel.Info, LogLevel.Warn, LogLevel.Error, LogLevel.Debug] : deps.config.logger;
    }

    lastLogTime: number = new Date().getTime();
    private getLogPrefix(logLevel: LogLevel) {
        const logDate = new Date();
        const lastLogTime = logDate.getTime();
        const timeDiff = lastLogTime - this.lastLogTime;
        this.lastLogTime = lastLogTime;

        const logTimeFormatted = `${logDate.getHours().toString().padStart(2, '0')}:${logDate.getMinutes().toString().padStart(2, '0')}:${logDate.getSeconds().toString().padStart(2, '0')}:${logDate.getMilliseconds().toString().padStart(3, '0')}`;
        let logLevelFormatted = `${logLevel}`.padStart(5, ' ');
        if (logLevel === LogLevel.Info) logLevelFormatted = logLevelFormatted;
        if (logLevel === LogLevel.Warn) logLevelFormatted = logLevelFormatted;
        if (logLevel === LogLevel.Error) logLevelFormatted = logLevelFormatted;
        if (logLevel === LogLevel.Debug) logLevelFormatted = logLevelFormatted;

        return `${logTimeFormatted} ${logLevelFormatted} ${this.namespace}\t`;
    }

    info(...args: any) {
        if (this.logLevels.includes(LogLevel.Info)) console.info(this.getLogPrefix(LogLevel.Info), ...args);
    }
    warn(...args: any) {
        if (this.logLevels.includes(LogLevel.Warn)) console.warn(this.getLogPrefix(LogLevel.Warn), ...args);
    }
    error(...args: any) {
        if (this.logLevels.includes(LogLevel.Error)) console.error(this.getLogPrefix(LogLevel.Error), ...args);
    }
    debug(...args: any) {
        if (this.logLevels.includes(LogLevel.Debug)) console.debug(this.getLogPrefix(LogLevel.Debug), ...args);
    }
}