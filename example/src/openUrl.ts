/**
 * An Android launcher that keeps a deeplink's scheme exactly as the gateway wrote it.
 *
 * `Linking.openURL` builds `Intent(ACTION_VIEW, Uri.parse(url).normalizeScheme())`, and
 * `normalizeScheme` lowercases the scheme. IntentFilter matching is case-sensitive, so a
 * bank app that registers `fonepayApp` — as Fonepay's does — is unreachable through
 * `Linking`, while a browser opens the same link because it does not normalize.
 *
 * `expo-intent-launcher` sets the URI it is given, so the scheme survives.
 *
 * This lives in the example rather than the SDK because it is a dependency the package will
 * not take: `@suqo/react-native` is plain React Native, with no Expo modules. Apps that need
 * it pass this as `openUrl` to `SuqoProvider`; apps that do not leave the prop unset.
 */
import { Linking, Platform } from 'react-native'

import * as IntentLauncher from 'expo-intent-launcher'

const ACTION_VIEW = 'android.intent.action.VIEW'

export async function openUrl(url: string): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openURL(url)
    return
  }

  // Throws when no activity resolves, which is the contract `openExternal` expects: the
  // rejection is what moves it on to the next candidate.
  await IntentLauncher.startActivityAsync(ACTION_VIEW, { data: url })
}
