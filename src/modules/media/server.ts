import { Module } from 'src/module';
import { ChildProcess, spawn, execSync } from 'child_process'

const go2rtcPath = new URL('./go2rtc', import.meta.url).pathname;
const go2rtcConfigPath = new URL('./go2rtc.yaml', import.meta.url).pathname;

export class MediaModuleServer extends Module {
    private go2rtcProcess: ChildProcess | null = null;
    async onModuleInit() {
        this.startGo2Rtc();
    }


    // stopGo2Rtc() {
    //     if (this.go2rtcProcess) {
    //         this.logger.info("Stopping go2rtc process...");
    //         this.go2rtcProcess.removeAllListeners();
    //         this.go2rtcProcess.stdout.removeAllListeners();
    //         this.go2rtcProcess.stderr.removeAllListeners();
    //         this.go2rtcProcess.kill(0);
    //         this.go2rtcProcess = null;
    //     }
    // }
    startGo2Rtc() {
        this.logger.info("Starting go2rtc process...");
        try {
            // Attempt to kill existing process
            // In dev mode this doesn't get killed otherwise when hot reload happens.
            execSync(`pgrep -f ${go2rtcPath} | xargs -r kill -9`);
        } catch (err) { }
        
        const go2rtcProcess = spawn(go2rtcPath, ['-c', go2rtcConfigPath], {
            stdio: 'inherit',
        });

        go2rtcProcess.on('close', (code) => {
            this.logger.info(`go2rtc process exited with code ${code}`);

            if (code !== 0) {
                this.logger.info("Restarting go2rtc process in 5 seconds...");
                setTimeout(() => {
                    this.startGo2Rtc(); // Restart the process if it exits with error
                }, 5000); // wait 5 seconds before restarting
            }
        });

        go2rtcProcess.on('error', (err) => {
            this.logger.error(`Failed to start go2rtc process: ${err}`);
        });

        this.go2rtcProcess = go2rtcProcess;
    }
}
