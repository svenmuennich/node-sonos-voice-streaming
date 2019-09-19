const VoiceStreamingClient = require('../client/index');
const eventTopics = require('../eventTopics');
const config = require('./config');

const recordDuration = 10000;

let recordProcess = null;
const client = new VoiceStreamingClient(config.serverUrl);
client.socket.on('authenticate', () => {
    console.log('AUTHENTICATING...');
    client.socket.emit('authentication', config.authentication);
    client.startStream();
});
client.socket.on(eventTopics.audioLiveStream.ready, () => {
    console.log('READY EVENT');
    recordProcess = client.record();
    setTimeout(
        async () => {
            await endStream();
        },
        recordDuration,
    );
});

async function endStream() {
    return new Promise((resolve) => { // eslint-disable-line promise/avoid-new
        recordProcess.kill('SIGTERM');
        recordProcess.once('exit', () => {
            resolve();
        });
    });
}
