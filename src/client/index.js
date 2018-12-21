const socketIoClient = require('socket.io-client');
const streamChunker = require('stream-chunker');
const UUID = require('uuid/v4');
const EventEmitter = require('events');
const { spawn } = require('child_process');

const eventNames = require('../eventNames');

module.exports = class VoiceStreamingClient extends EventEmitter {
    constructor(serverUrl, recordingOptions = [], recordingFormat = 'mp3', chunkSize = 128) {
        super();

        this.serverUrl = serverUrl;
        this.recordingOptions = recordingOptions;
        this.recordingFormat = recordingFormat;
        this.chunkSize = chunkSize;
        this.streamId = `${UUID()}.${recordingFormat}`;
    }

    startStream() {
        this.socket = socketIoClient(this.serverUrl);
        this.socket.on(eventNames.audioLiveStream.ready, () => {
            console.log(`Stream ${this.streamId} is ready for recording.`);
            this.emit(eventNames.audioLiveStream.ready);
            this.record();
        });

        console.log(`Setting up stream ${this.streamId}...`);
        this.socket.emit(eventNames.audioLiveStream.setUp, {
            streamId: this.streamId,
        });
    }

    record() {
        console.log(`Recording stream ${this.streamId}...`);
        const chunker = streamChunker(
            this.chunkSize,
            {
                flush: true,
                align: false,
            }
        );
        chunker.on('data', (data) => {
            this.socket.emit(eventNames.audioLiveStream.chunk, {
                streamId: this.streamId,
                data: data.toString('base64'),
            });
        });
        chunker.on('end', () => {
            console.log(`Tearing down stream ${this.streamId}...`);
            this.socket.emit(eventNames.audioLiveStream.tearDown, {
                streamId: this.streamId,
            });
            this.socket.disconnect(0);
        });

        this.recordProcess = spawn('rec', [ // see http://sox.sourceforge.net
            '-q', // don't show stats
            '-t', this.recordingFormat,
            '-c', '1', // mono
            '-r', '44100', // 44100Hz sample rate
            '-b', '16', // little endian 16 bit
            '-', // write audio to stdout
            ...this.recordingOptions,
        ]);
        this.recordProcess.stdout.pipe(chunker);
    }
};
