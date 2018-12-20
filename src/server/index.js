const koaMount = require('koa-mount');
const koaRouter = require('koa-router');
const KoaSocketIO = require('koa-socket-2');
const koaStatic = require('koa-static');
const sha1 = require('sha1');
const { URL } = require('url');

const audioStreamService = require('./services/audioStreamService');
const eventNames = require('../eventNames');
const routes = require('./routes');

const streamSessions = {};

module.exports = async (options) => {
    const { app, baseUrl, sonosControl } = options;
    const pathPrefix = options.pathPrefix || '/';

    // Serve static files like announcement chime
    const staticFilesBasePath = `${pathPrefix}/static`;
    app.use(koaMount(staticFilesBasePath, koaStatic(`${__dirname}/static`)));

    // Register the live stream route
    const router = koaRouter();
    const liveStreamBasePath = `${pathPrefix}/liveStream`;
    router.get(`${liveStreamBasePath}/:streamId`, routes.liveStream);
    app.use(router.routes());
    app.use(router.allowedMethods());

    // Attach a socket to the app
    const socketIo = new KoaSocketIO();
    socketIo.attach(app);

    const players = await sonosControl.getPlayers();
    console.log(players);

    // TODO: Dynamically regroup all speakers in the configured household. Load speakers here.
    const groupId = 'RINCON_7828CA0F18DA01400:4281004221';

    // Initialize the web socket
    socketIo.on('connection', (connection) => {
        const socket = connection.socket;
        console.log(`New socket ${socket.id} connected`);

        socket.on(eventNames.audioLiveStream.setUp, async (payload) => {
            console.log(`Setting up live audio stream ${payload.streamId}...`);
            const sononsSessionId = await sonosControl.ensurePlaybackSession(groupId, sha1(payload.streamId));
            audioStreamService.createStream(payload.streamId);
            streamSessions[payload.streamId] = sononsSessionId;
            socket.emit(eventNames.audioLiveStream.ready, {});

            // TODO: Kill stream if no event has been received for 2 seconds
        });

        socket.on(eventNames.audioLiveStream.chunk, async (payload) => {
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
                const streamUrl = new URL(`${liveStreamBasePath}/${payload.streamId}`, baseUrl);
                console.log(`New stream available at ${streamUrl.toString()}`);
                await sonosControl.loadStreamUrl(sonosSessionId, streamUrl.toString());

                // Play an announcement chime clip AFTER starting the audio stream to work around the delay caused by
                // the SONOS speaker (ca. 7 seconds)
                const announcementChimeUrl = new URL(`${staticFilesBasePath}/announcement_chime.mp3`, baseUrl);
                sonosControl.playAudioClipOnAllSpeakers(announcementChimeUrl.toString());
            }
        });

        socket.on(eventNames.audioLiveStream.tearDown, async (payload) => {
            console.log(`Tearing down stream ${payload.streamId}...`);
            audioStreamService.endStream(payload.streamId);
            const sonosSessionId = streamSessions[payload.streamId];
            await sonosControl.suspendPlaybackSession(sonosSessionId);
        });
    });
};
