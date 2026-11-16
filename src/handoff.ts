/**
 * Handing a navigation to the OS, for the bank and wallet apps a WebView cannot reach.
 *
 * @packageDocumentation
 */

import { Linking, Platform } from 'react-native'

import { log } from './log'
import { classifyNavigation } from './urls'

const INTENT_PREFIX = 'intent:'

const HTTP_RE = /^https?:\/\//i

/** The scheme of a candidate, for the log line that reports what reached `Linking`. */
const SCHEME_OF = /^([a-z][a-z0-9+.-]*):/i

/**
 * How a URL is handed to the OS. Supplied by the host app to replace `Linking.openURL`.
 *
 * The reason this exists is narrow and Android-specific. `Linking.openURL` builds
 * `Intent(ACTION_VIEW, Uri.parse(url).normalizeScheme())`, and `normalizeScheme` lowercases
 * the scheme while IntentFilter matching is case-sensitive — so a bank app that registers
 * `fonepayApp` can never be reached through `Linking`, even though a browser opens the same
 * link, because a browser does not normalize. An app that must launch such a bank supplies
 * its own opener here (`expo-intent-launcher`, or its own native module) and keeps the
 * scheme exactly as the gateway wrote it.
 *
 * Only the launch is replaced. The rewrite of `intent://` URLs, the candidate order and the
 * refusal of blocked schemes stay in this package, so a host cannot opt out of them.
 *
 * Reject (or throw) when the launch fails, so the next candidate is tried; resolving is
 * taken as success.
 */
export type OpenUrl = (url: string) => void | Promise<void>

/** Whether `url` is an Android intent URI, in either the authority-less or `//` form. */
export function isIntentUrl(url: string): boolean {
  return url.trimStart().toLowerCase().startsWith(INTENT_PREFIX)
}

/**
 * The URLs an `intent://` URI actually means, best first.
 *
 * `Linking.openURL` cannot launch `intent://` at all. React Native's Android side builds
 * `Intent(ACTION_VIEW, Uri.parse(url).normalizeScheme())` and never
 * `Intent.parseUri(url, URI_INTENT_SCHEME)` — verified in `IntentModule.kt` on 0.76 and
 * still true on 0.86 — so the parsed scheme is the literal `intent`, nothing on the device
 * declares a filter for it, and the launch throws. Handing one straight to `Linking` is
 * therefore guaranteed to do nothing, which is what this package used to do while
 * `classifyNavigation`'s own docs promised otherwise.
 *
 * The fragment carries the real target:
 *
 *     intent://pay/?q=1#Intent;scheme=fonepay;package=com.x;S.browser_fallback_url=https%3A%2F%2F…;end
 *
 * `scheme=` plus the body rebuilds the deeplink the gateway meant (`fonepay://pay/?q=1`),
 * and `S.browser_fallback_url` is Android's own documented fallback — usually a Play Store
 * page for the app that is not installed. Both are returned, deeplink first, so a buyer
 * without the bank app still lands somewhere useful instead of nowhere.
 *
 * iOS cannot resolve `intent:` under any circumstances, but it can resolve what this
 * rebuilds: the deeplink launches there too when the bank app is installed and claims that
 * scheme, and the fallback URL opens in the browser when it is not.
 *
 * Mirrors `intentTargets` in the Flutter SDK (`lib/src/handoff.dart`); the two are expected
 * to accept the same inputs, so a change here belongs there too.
 */
export function intentTargets(url: string): string[] {
  if (!isIntentUrl(url)) return []

  // Trimmed once, up front: `isIntentUrl` tolerates leading space, and slicing a fixed
  // `intent:` length off an untrimmed string would cut in the wrong place.
  const trimmed = url.trim()

  const hash = trimmed.indexOf('#')
  if (hash < 0) return []

  // Everything between the scheme and the fragment. The authority-less form `intent:pay`
  // is as valid as `intent://pay` and gateways emit both, so the body is taken from after
  // `intent:` and any `//` stripped, rather than sliced at a fixed `intent://` length —
  // which on the short form would have eaten the first two characters of the path.
  let body = trimmed.slice(INTENT_PREFIX.length, hash)
  if (body.startsWith('//')) body = body.slice(2)

  const targets: string[] = []

  let scheme: string | undefined
  let fallback: string | undefined
  for (const part of trimmed.slice(hash + 1).split(';')) {
    if (part.startsWith('scheme=')) {
      scheme = part.slice('scheme='.length)
    } else if (part.startsWith('S.browser_fallback_url=')) {
      const raw = part.slice('S.browser_fallback_url='.length)
      try {
        fallback = decodeURIComponent(raw)
      } catch {
        // A truncated or invalid escape — `%`, `%ZZ`, a half-written UTF-8 sequence.
        // `decodeURIComponent` throws a URIError on all three. The deeplink is usually
        // still good, so drop this one target rather than the whole handoff.
        log('handoff.bad_fallback', { error: 'undecodable fallback url' })
      }
    }
  }

  if (scheme) targets.push(`${scheme}://${body}`)
  // http(s) only. The fallback is the one field here that names a whole URL rather than a
  // scheme, so it is the one an attacker-controlled page would reach for.
  if (fallback !== undefined && HTTP_RE.test(fallback.trim())) targets.push(fallback)
  return targets
}

/**
 * Opens `url` outside the WebView. Resolves true when the OS accepted it.
 *
 * An `intent:` URI cannot be launched as written, so it is rewritten first — see
 * {@link intentTargets}. Everything else is attempted as given.
 *
 * `canOpenURL` is consulted but **not** trusted to say no. On Android 11+ it answers false
 * for any scheme the host app has not declared in its manifest `queries`, and this package
 * cannot add manifest entries on a consumer's behalf — so a false there usually means
 * "undeclared", not "no app installed". The open is attempted regardless.
 *
 * Be aware of two Android launch failures this cannot work around, both of which show up
 * here as `handoff.failed` with "No Activity found":
 *
 * - **Missing `<queries>`.** Without one `<intent>` block per scheme in the host app's
 *   manifest, Android 11+ hides the target app and the launch fails as well as the probe.
 * - **A mixed-case scheme.** `Linking.openURL` runs `Uri.parse(url).normalizeScheme()`,
 *   which lowercases the scheme, and IntentFilter matching is case-sensitive — so an app
 *   registering `fonepayApp` is unreachable through `Linking`, though a browser (which
 *   does not normalize) opens the same link. `schemeLowercased` in `handoff.candidate`
 *   flags when a URL is exposed to this.
 */
export async function openExternal(url: string, openUrl?: OpenUrl): Promise<boolean> {
  const intent = isIntentUrl(url)
  const candidates = intent ? intentTargets(url) : [url]

  log('handoff.start', {
    platform: Platform.OS,
    form: intent ? 'intent-url' : 'custom-scheme',
    candidates: candidates.length,
    opener: openUrl ? 'host' : 'linking',
  })

  if (candidates.length === 0) {
    log('handoff.failed', { step: 'rewrite', error: 'intent url named no target' })
    return false
  }

  for (const [index, candidate] of candidates.entries()) {
    const scheme = SCHEME_OF.exec(candidate)?.[1] ?? ''
    log('handoff.candidate', {
      index,
      scheme,
      // The signal for the case-sensitivity trap described above: true means `Linking` will
      // hand the OS a different scheme than the one the page named.
      schemeLowercased: scheme !== scheme.toLowerCase(),
    })

    // Back through the same classifier the WebView's navigation goes through. A rebuilt
    // candidate is attacker-influenced input: after a handoff the WebView is on the
    // gateway's and the bank's pages, not SUQO's, and one of those naming `scheme=file` —
    // or a `javascript:` fallback — would otherwise hand `Linking` exactly the schemes
    // `BLOCKED_SCHEMES` exists to refuse. Chrome restricts `browser_fallback_url` to
    // http(s) for this same reason.
    const navigation = classifyNavigation(candidate)
    if (navigation.kind === 'block') {
      log('handoff.blocked', { step: 'classify', scheme: navigation.scheme })
      continue
    }

    try {
      // Consulted for the log line only — see above.
      const supported = await Linking.canOpenURL(candidate).catch(() => false)
      log('handoff.attempt', { index, scheme, supported })
      await (openUrl ? openUrl(candidate) : Linking.openURL(candidate))
      log('handoff.opened', { index, scheme })
      return true
    } catch (error) {
      log('handoff.failed', {
        step: 'open',
        index,
        scheme,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  log('handoff.exhausted', { candidates: candidates.length })

  return false
}
