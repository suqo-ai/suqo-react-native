import Constants from 'expo-constants'

/** The port `npm run mock` listens on. */
const MOCK_PORT = 8787

/**
 * The machine running Metro, as the device can reach it.
 *
 * `localhost` is the obvious default and is wrong on every physical device: there it means
 * the phone itself, and the mock server is on your laptop. It only appears to work on an
 * emulator, and only because `adb reverse` happens to be set up — so the failure shows up
 * the first time anyone runs this on real hardware, as `ERR_CONNECTION_REFUSED`.
 *
 * Expo already knows the answer: `hostUri` is the host the app fetched its bundle from, which
 * is by definition an address the device can reach. Falls back to localhost when it is absent
 * (a production build, where this example is not run anyway).
 */
function mockServerUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri
  const host = hostUri?.split(':')[0]
  return host ? `http://${host}:${MOCK_PORT}` : `http://localhost:${MOCK_PORT}`
}

/**
 * Where the example points.
 *
 * Set `EXPO_PUBLIC_SUQO_BASE_URL` to run against a real deployment — a dev server, a test
 * environment, anything serving the checkout route. Leave it unset and the app defaults to
 * the mock server (`npm run mock`), which needs no backend at all.
 *
 * Either way it is editable on the home screen, so switching does not need a restart.
 */
export const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_SUQO_BASE_URL ?? mockServerUrl()

/**
 * Any non-empty string works against the mock server; a real deployment needs a real
 * checkout session id, created by your backend through SUQO's API. The session already
 * carries the buyer, which is why nothing about them appears anywhere in this app.
 */
export const DEFAULT_SESSION_ID = process.env.EXPO_PUBLIC_SUQO_SESSION_ID ?? 'cks_mock1'
