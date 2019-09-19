const Koa = require('koa');
const KoaRouter = require('@koa/router');
const sha1 = require('sha1');
const { URL } = require('url');

const audioStreamService = require('./services/audioStreamService');
const eventTopics = require('../eventTopics');
const routes = require('./routes');

async function handleLiveStreamSetup(payload, sonosControl, streamSessions, socket) {
    // Update player context
    const groupData = await sonosControl.getCachedGroupData();
    if (!groupData || !groupData.players) {
        throw new Error('No player info avaiable');
    }

    console.log(`Setting up live audio stream ${payload.streamId}...`);
    const playerIds = groupData.players.map(player => player.id);
    const allPlayersGroupId = await sonosControl.createOrFetchGroup(playerIds);
    const sonosSessionId = await sonosControl.ensurePlaybackSession(allPlayersGroupId, sha1(payload.streamId));

    audioStreamService.createStream(
        payload.streamId,
        async () => {
            await sonosControl.suspendPlaybackSession(sonosSessionId);
            await sonosControl.setGroupMembers(allPlayersGroupId, []);
        },
    );
    streamSessions[payload.streamId] = sonosSessionId;
    socket.emit(eventTopics.audioLiveStream.ready, {});
}

async function handleLiveStreamChunk(payload, eventBus, sonosControl, streamSessions, baseUrl) {
    // Find audio stream
    const stream = audioStreamService.streams[payload.streamId];
    if (!stream) {
        console.log(`Cannot update buffer of stream ${payload.streamId}. Stream not found.`);

        return;
    }

    // Append data to stream buffer
    const isFirstChunk = stream.isEmpty();
    stream.appendChunk(payload.data);

    if (isFirstChunk) {
        // Start streaming on the SONOS speakers
        const sonosSessionId = streamSessions[payload.streamId];
        const streamUrl = new URL(`${baseUrl.pathname}/audioStream/${payload.streamId}`, baseUrl);
        console.log(`New stream available at ${streamUrl.toString()}`);
        sonosControl.loadStreamUrlInPlaybackSession(streamUrl.toString(), sonosSessionId);

        eventBus.publish(eventTopics.playback.started, {});
    }
}

async function handleLiveStreamTeardown(payload) {
    console.log(`Stream ${payload.streamId} ended.`);
}

module.exports = (mountUrl, eventBus, sonosControl, registerWebSocketHandler) => {
    const router = new KoaRouter();
    router.get('/audioStream/:streamId', routes.audioStream);

    const app = new Koa();
    app.use(router.routes());
    app.use(router.allowedMethods());

    const streamSessions = {};
    registerWebSocketHandler((socket) => {
        socket.on(eventTopics.audioLiveStream.setUp, async (payload) => {
            handleLiveStreamSetup(payload, sonosControl, streamSessions, socket);
        });
        socket.on(eventTopics.audioLiveStream.chunk, async (payload) => {
            handleLiveStreamChunk(payload, eventBus, sonosControl, streamSessions, mountUrl);
        });
        socket.on(eventTopics.audioLiveStream.tearDown, handleLiveStreamTeardown);
    });

    return app;
};
