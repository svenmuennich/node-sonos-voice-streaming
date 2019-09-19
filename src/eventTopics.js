module.exports = {
    audioLiveStream: {
        chunk: 'node_sonos_voice_streaming/audio_live_stream/chunk',
        ready: 'node_sonos_voice_streaming/audio_live_stream/ready',
        setUp: 'node_sonos_voice_streaming/audio_live_stream/set_up',
        tearDown: 'node_sonos_voice_streaming/audio_live_stream/tear_down',
    },
    playback: {
        started: 'node_sonos_voice_streaming/playback/started',
    },
};
