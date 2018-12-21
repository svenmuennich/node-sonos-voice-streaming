const { ReadableStreamBuffer } = require('stream-buffers');

const streamBufferFrequency = 5; // in milliseconds
const streamBufferChunkSize = 128; // in bytes

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
                console.log(
                    `Closing audio stream ${this.streamId}, because no data chunk has been received for 3 seconds...`
                );
                this.suicideCallback();
            },
            5000 // 5 seconds
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

    close() {
        setTimeout(
            () => {
                this.streamBuffers.forEach(buffer => buffer.stop());
            },
            8000 // 8 seconds
        );
    }
}

class AudioStreamService {
    constructor() {
        this.streams = {};
    }

    createStream(streamId) {
        const stream = new AudioStream(streamId, () => {
            this.endStream(streamId);
        });
        this.streams[streamId] = stream;

        return stream;
    }

    endStream(streamId) {
        if (this.streams[streamId]) {
            this.streams[streamId].close();
            delete this.streams[streamId];
        }
    }
}

module.exports = new AudioStreamService();
