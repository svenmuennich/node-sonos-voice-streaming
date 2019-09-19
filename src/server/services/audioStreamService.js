const { ReadableStreamBuffer } = require('stream-buffers');

const streamBufferFrequency = 5; // in milliseconds
const streamBufferChunkSize = 128; // in bytes
const suicideTimeout = 7000; // 7 seconds

class AudioStream {
    constructor(streamId, suicideCallback) {
        this.streamId = streamId;
        this.suicideCallback = suicideCallback;
        this.data = Buffer.from([]);
        this.streamBuffers = [];
    }

    isEmpty() {
        return this.data.length === 0;
    }

    appendChunk(encodedChunk) {
        const incomingBuffer = Buffer.from(encodedChunk, 'base64');
        this.data = Buffer.concat([this.data, incomingBuffer]);
        this.streamBuffers.forEach(buffer => buffer.put(incomingBuffer));

        if (this.suicideTimeout) {
            clearTimeout(this.suicideTimeout);
        }
        this.suicideTimeout = setTimeout(
            () => {
                console.log(`Closing audio stream ${this.streamId}, because no data chunk has been received for `
                    + `${suicideTimeout}ms...`);
                this.suicideCallback();
            },
            suicideTimeout,
        );
    }

    createReadableBuffer() {
        const buffer = new ReadableStreamBuffer({
            frequency: streamBufferFrequency,
            chunkSize: streamBufferChunkSize,
        });
        buffer.put(this.data);
        this.streamBuffers.push(buffer);

        return buffer;
    }

    endStreamBuffers() {
        this.streamBuffers.forEach(buffer => buffer.stop());
    }
}

class AudioStreamService {
    constructor() {
        this.streams = {};
        this.tearDownAudioSessionCallback = undefined;
    }

    createStream(streamId, tearDownCallback) {
        const stream = new AudioStream(streamId, () => {
            this.endStream(streamId);
        });

        this.streams[streamId] = stream;
        this.tearDownAudioSessionCallback = tearDownCallback;

        return stream;
    }

    endStream(streamId) {
        console.log(`Ending stream ${streamId}...`);
        if (this.streams[streamId]) {
            this.streams[streamId].endStreamBuffers();
            delete this.streams[streamId];
        }

        if (Object.keys(this.streams).length === 0 && this.tearDownAudioSessionCallback) {
            this.tearDownAudioSessionCallback();
        }
    }
}

module.exports = new AudioStreamService();
