const { ReadableStreamBuffer } = require('stream-buffers');

const streamBufferFrequency = 5; // in milliseconds
const streamBufferChunkSize = 128; // in bytes

class AudioStream {
    constructor(streamId) {
        this.streamId = streamId;
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
        this.streamBuffers.forEach(buffer => buffer.stop());
    }
}

class AudioStreamService {
    constructor() {
        this.streams = {};
    }

    createStream(streamId) {
        const stream = new AudioStream(streamId);
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
