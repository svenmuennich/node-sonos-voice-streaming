const axios = require('axios');
const querystring = require('querystring');

const sonosClientId = process.env.SONOS_CLIENT_ID;
const sonosClientSecret = process.env.SONOS_CLIENT_SECRET;

module.exports = class SonosAuth {
    constructor() {
        this.client = axios.create({
            baseURL: 'https://api.sonos.com/login/v3/oauth/',
            headers: {
                Authorization: `Basic ${Buffer.from(`${sonosClientId}:${sonosClientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    }

    async createAuthorizationToken(code, redirectUri) {
        const response = await this.client.post(
            'access',
            querystring.stringify({
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
            })
        );

        return {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
        };
    }

    async refreshAccessToken(refreshToken) {
        const response = await this.client.post(
            'access',
            querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            })
        );

        return response.data.access_token;
    }
};
