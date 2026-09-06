export const DEFAULT_PIPES = [];

export const DEFAULT_LEAKAGE_POINTS = [];

export const DEFAULT_MQTT = {
    BROKER: window.location.protocol === 'https:'
        ? 'wss://broker.hivemq.com:8884/mqtt'
        : 'ws://broker.hivemq.com:8000/mqtt',
    TOPIC: 'water/data'
};
