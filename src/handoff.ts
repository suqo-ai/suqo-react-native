/**
 * Handing a navigation to the OS, for the bank and wallet apps a WebView cannot reach.
 *
 * @packageDocumentation
 */

import { Linking } from 'react-native'

import { log } from './log'

/**
 * Opens `url` outside the WebView. Resolves true when the OS accepted it.
 *
 * `canOpenURL` is consulted but **not** trusted to say no. On Android 11+ it answers false
 * for any scheme the host app has not declared in its manifest `queries`, and this package
 * cannot add manifest entries on a consumer's behalf — so a false there usually means
 * "undeclared", not "no app installed". Failing closed (attempting the open anyway) turns
 * that into a launch that either works or throws, instead of a dead end for a buyer who has
 * the bank app installed.
 */
export async function openExternal(url: string): Promise<boolean> {
  try {
    // Consulted for the log line only — see above.
    const supported = await Linking.canOpenURL(url).catch(() => false)
    log('handoff.attempt', { supported })
    await Linking.openURL(url)
    return true
  } catch (error) {
    log('handoff.failed', { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}
