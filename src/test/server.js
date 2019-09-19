const Koa = require('koa');
const koaMount = require('koa-mount');
const KoaSocketIO = require('koa-socket-2');
const { SonosAuthorization, SonosControl } = require('node-sonos-rest-api-client'); // eslint-disable-line import/no-extraneous-dependencies,max-len
const { URL } = require('url');

const server = require('../server');
const config = require('./config');

const mountPath = '/soundboard';
const sonosAuthorization = new SonosAuthorization(config.sonos.clientId, config.sonos.clientSecret);
const sonosControl = new SonosControl(
    config.sonos.appId,
    config.sonos.householdId,
    config.sonos.oAuthToken,
    sonosAuthorization,
);

const app = new Koa();
const socketIo = new KoaSocketIO();
socketIo.attach(app);
socketIo.on('connection', (socket) => {
    socket.emit('authenticate');
});

const serverApp = server(
    new URL(mountPath, config.serverUrl),
    {
        publish: (topic, payload) => console.log('PUBLISH', topic, payload),
    },
    sonosControl,
    (handler) => {
        socketIo.on('connection', handler);
    },
);
app.use(koaMount(mountPath, serverApp));

app.listen(5000);
console.log('Server listening for incoming streams...');
