/**
 * URL construction and navigation classification. Pure — no React, no React Native.
 *
 * @packageDocumentation
 */

import { SuqoConfigError } from './errors'

/**
 * The embedded checkout route, with `:id` standing in for the checkout session id.
 *
 * Configurable because this route is owned by a different repo and may be renamed. The
 * default is the route that exists today.
 */
export const DEFAULT_CHECKOUT_PATH = '/c/:id'

/** Where a live checkout is served from. */
export const LIVE_ORIGIN = 'https://app.suqo.ai'

/** Where a sandbox checkout is served from. */
export const SANDBOX_ORIGIN = 'https://test.suqo.ai'

/** The two checkout environments a merchant can pick between without naming a URL. */
export type CheckoutMode = 'live' | 'sandbox'

function originForMode(mode: CheckoutMode | undefined): string {
  return mode === 'live' ? LIVE_ORIGIN : SANDBOX_ORIGIN
}

/**
 * Resolves the base URL `{@link buildCheckoutUrl}` loads.
 *
 * An explicit `baseUrl` always wins — it is how an app points at something other than
 * `app.suqo.ai` / `test.suqo.ai` (a staging mirror, a local mock server). Otherwise `mode`
 * picks between {@link LIVE_ORIGIN} and {@link SANDBOX_ORIGIN}, defaulting to sandbox so an
 * app that names neither cannot accidentally take a live payment.
 */
export function resolveBaseUrl(baseUrl: string | undefined, mode?: CheckoutMode): string {
  if (typeof baseUrl === 'string' && baseUrl.trim() !== '') return baseUrl
  return originForMode(mode)
}

/**
 * The URL the sheet loads.
 *
 * Nothing is appended to the query string, ever. NPS appends its own return parameters with
 * a literal `?` rather than `&`, so anything added to a query string that reaches a gateway
 * comes back mangled and swallows the gateway's own transaction id. That constraint is why
 * the browser SDK puts its host origin in the URL hash, and it applies equally here.
 */
export function buildCheckoutUrl(
  baseUrl: string,
  sessionId: string,
  checkoutPath: string = DEFAULT_CHECKOUT_PATH
): string {
  const trimmed = baseUrl.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new SuqoConfigError(
      `baseUrl must be an http(s) URL — received ${JSON.stringify(baseUrl)}`
    )
  }
  if (!sessionId.trim()) {
    throw new SuqoConfigError('sessionId is required')
  }

  const origin = trimmed.replace(/\/+$/, '')
  const path = checkoutPath.includes(':id')
    ? checkoutPath.replace(':id', encodeURIComponent(sessionId))
    : `${checkoutPath.replace(/\/+$/, '')}/${encodeURIComponent(sessionId)}`

  return origin + (path.startsWith('/') ? path : `/${path}`)
}

/** What the WebView should do with a navigation it is about to start. */
export type Navigation =
  /** Let the WebView load it. */
  | { kind: 'allow' }
  /** Hand it to the OS — a bank or wallet app. The WebView cannot resolve these itself. */
  | { kind: 'handoff'; scheme: string }
  /** Neither load nor hand off. A scheme with no business in a payment flow. */
  | { kind: 'block'; scheme: string }

/** Schemes that must never reach a navigation sink or `Linking.openURL`. */
const BLOCKED_SCHEMES = new Set(['javascript', 'data', 'file', 'blob'])

const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i

/**
 * Classifies a navigation.
 *
 * The interesting case is `handoff`. ConnectIPS and NPS hand off to bank apps through
 * custom-protocol deeplinks (`fonepayApp://…`) and, on Android, `intent://` URLs. A WebView
 * resolves neither — an `intent://` navigation inside one simply fails, and an unhandled
 * custom scheme does nothing at all. Both have to be lifted out to `Linking.openURL`, which
 * is the single reason this function exists rather than the WebView being left to itself.
 *
 * Return pages are deliberately **allowed** to load. `/payment-success` is what posts the
 * verification call; intercepting it to read the outcome off the query string would skip
 * verification entirely and report a payment nobody confirmed.
 */
export function classifyNavigation(url: string): Navigation {
  const match = SCHEME_RE.exec(url.trim())
  if (!match) return { kind: 'allow' } // relative or scheme-less: same-document

  const scheme = (match[1] ?? '').toLowerCase()
  if (scheme === 'http' || scheme === 'https') return { kind: 'allow' }
  if (scheme === 'about') return { kind: 'allow' } // about:blank, the initial load
  if (BLOCKED_SCHEMES.has(scheme)) return { kind: 'block', scheme }
  return { kind: 'handoff', scheme }
}

/** Whether `url` needs the OS rather than the WebView. */
export function isAppHandoff(url: string): boolean {
  return classifyNavigation(url).kind === 'handoff'
}
