const axios = require('axios');
const SonosAuth = require('./sonosAuth');

const sonosHouseholdId = process.env.SONOS_HOUSEHOLD_ID;
const sonosRefreshToken = process.env.SONOS_REFRESH_TOKEN;
const appId = 'com.pickware.internal.pickware-automation';

module.exports = class SonosControl {
    constructor(refreshToken = sonosRefreshToken, householdId = sonosHouseholdId) {
        this.refreshToken = refreshToken;
        this.householdId = householdId;
        this.authClient = new SonosAuth();
        this.client = axios.create({
            baseURL: 'https://api.ws.sonos.com/control/api/v1/',
        });
    }

    async refreshAccessToken() {
        const accessToken = await this.authClient.refreshAccessToken(this.refreshToken);
        this.client.defaults.headers.Authorization = `Bearer ${accessToken}`;
    }

    async getHouseholds() {
        await this.refreshAccessToken();
        const response = await this.client.get('households');

        return response.data.households;
    }

    async getPlayers(householdId = this.householdId) {
        await this.refreshAccessToken();
        const response = await this.client.get(`households/${householdId}/groups`);

        return response.data.players;
    }

    async loadStreamUrl(sessionId, streamUrl) {
        await this.client.post(`playbackSessions/${sessionId}/playbackSession/loadStreamUrl`, {
            itemId: 'foo',
            streamUrl,
            playOnCompletion: true,
        });
    }

    async suspendPlaybackSession(sessionId) {
        await this.client.post(`playbackSessions/${sessionId}/playbackSession/suspend`);
    }

    async ensurePlaybackSession(groupId, appContext) {
        try {
            // Try to create or join an existing session. This is likely to fail but also the only way to get the ID
            // of the currently active session, if any.
            const response = await this.client.post(`groups/${groupId}/playbackSession/joinOrCreate`, {
                appContext,
                appId,
            });

            return response.data.sessionId;
        } catch (err) {
            if (
                err.response.data.errorCode === 'ERROR_SESSION_IN_PROGRESS'
                && err.response.headers['x-sonos-session']
            ) {
                // Joining failed, but now we can use the currently active session
                return err.response.headers['x-sonos-session'];
            }
        }

        return undefined;
    }

    async playAudioClipOnAllPlayers(mediaUrl) {
        const players = await this.getPlayers();
        await Promise.all(players.map(async (player) => {
            await this.playAudioClipOnPlayer(mediaUrl, player.id);
        }));
    }

    async playAudioClipOnPlayer(mediaUrl, playerId) {
        const players = await this.getPlayers();
        const player = players.find(anyPlayer => anyPlayer.id === playerId);
        if (!player) {
            console.info(`Player with ID ${player.id} not found`);

            return;
        }

        console.info(`Playing audio clip on player "${player.name}" (${player.id})`);
        await this.client.post(`players/${player.id}/audioClip`, {
            appId,
            name: 'pickware-automation-audio-clip',
            streamUrl: mediaUrl,
        });
    }
};
