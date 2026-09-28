/**
 * Where the example points.
 *
 * Set `EXPO_PUBLIC_SUQO_BASE_URL` to run against a real deployment — a dev server, a test
 * environment, anything serving the checkout route. Leave it unset and the app defaults to
 * the mock server (`npm run mock`), which needs no backend at all.
 *
 * Either way it is editable on the home screen, so switching does not need a restart.
 */
export const DEFAULT_BASE_URL = process.env.EXPO_PUBLIC_SUQO_BASE_URL ?? 'http://localhost:8787'

/**
 * Any non-empty string works against the mock server; a real deployment needs a real
 * checkout session id, created by your backend through SUQO's API. The session already
 * carries the buyer, which is why nothing about them appears anywhere in this app.
 */
export const DEFAULT_SESSION_ID = process.env.EXPO_PUBLIC_SUQO_SESSION_ID ?? 'cks_mock1'
