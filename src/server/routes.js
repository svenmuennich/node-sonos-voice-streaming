const audioStreamService = require('./services/audioStreamService');

module.exports = {
    liveStream: (ctx) => {
        const streamId = ctx.params.streamId;
        const stream = audioStreamService.streams[streamId];
        if (!stream) {
            console.log(`Stream ${streamId} not found`);

            return;
        }

        console.log(`Serving stream ${streamId}...`, (new Date()).getTime());
        ctx.header.contentType = 'audio/mpeg';
        ctx.body = stream.createReadableBuffer();
    },
};
