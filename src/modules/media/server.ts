import { Module } from 'src/module';

export class MediaModuleServer extends Module {
    async onModuleInit() {
        this.on('takePicture', () => {
            this.logger.info('Take picture command received');
            this.takePicture();
        });
        this.on('startRecording', () => {
            this.logger.info('Start recording command received');
            // Here you would implement the logic to start recording
            // For example, you could use GStreamer to start a video stream
        });

    }

    takePicture(): void {
        // this.logger.info('Taking picture...');
        this.logger.error("Not implemented: takePicture()");
        return;
    }

}
