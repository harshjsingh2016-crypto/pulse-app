// Sentry's getSentryExpoConfig wraps Expo's default Metro config so that source
// maps are generated/uploaded for symbolicated stack traces.
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);

module.exports = config;
