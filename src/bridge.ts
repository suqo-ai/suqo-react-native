/**
 * The wire between this SDK and the SUQO checkout page inside the WebView.
 *
 * It runs in one direction. The page is a checkout session — it is created on the merchant's
 * backend and already carries the buyer — so there is nothing this SDK knows that the page
 * needs, and nothing is ever injected into it but the optional debug forwarder.
 *
 * What makes the page reachable at all is that it recognises a native host by the bridge
 * `react-native-webview` injects for us: it checks for `window.SuqoWebView`, then
 * `window.ReactNativeWebView`, and routes `postToHost` through whichever it finds. No
 * cooperation is required from this side.
 *
 * @packageDocumentation
 */

import type { ReturnParams, SuqoEvent } from './types'

/** Every message in both directions carries this. Anything without it is ignored. */
export const MESSAGE_SOURCE = 'suqo-checkout'

/**
 * Forwards the page's own failures to the host's console. Only injected when `debug` is on.
 *
 * A WebView is otherwise opaque: a page that hangs mid-load looks identical to a page that
 * threw, and neither reaches the JavaScript console the developer is already watching.
 * Attaching Safari's inspector works but cannot be scripted, so this exists to make the
 * ordinary case debuggable.
 *
 * Injected before content loads, so an error thrown during the page's own boot is caught.
 */
export function buildDebugScript(): string {
  return `(function(){
  if (window.__suqoDebug) return
  window.__suqoDebug = true
  var send = function (level, text) {
    try {
      if (!window.ReactNativeWebView) return
      window.ReactNativeWebView.postMessage(JSON.stringify({
        source: '${MESSAGE_SOURCE}', type: 'suqo:debug', level: level, text: String(text).slice(0, 500)
      }))
    } catch (e) {}
  }
  window.addEventListener('error', function (event) {
    send('error', (event && event.message) || 'script error')
  })
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason
    send('error', 'unhandled rejection: ' + ((reason && (reason.message || reason)) || 'unknown'))
  })
  var wrap = function (level) {
    var original = console[level]
    console[level] = function () {
      try { send(level, Array.prototype.join.call(arguments, ' ')) } catch (e) {}
      if (original) original.apply(console, arguments)
    }
  }
  wrap('error')
  wrap('warn')
  // Every request the page makes, so a call that never comes back is visible as a request
  // with no matching response.
  var open = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url) {
    this.addEventListener('loadend', function () {
      send('net', method + ' ' + url + ' -> ' + this.status)
    })
    send('net', method + ' ' + url + ' ...')
    return open.apply(this, arguments)
  }
})();true;`
}

/** A message the page sends us. Mirrors the frame-to-host half of the browser protocol. */
export type InboundMessage =
  /** The document loaded and is running scripts. */
  | { type: 'suqo:alive' }
  /** The payment block is on screen. */
  | { type: 'suqo:ready' }
  /** The block's content height, in px. */
  | { type: 'suqo:resize'; height: number }
  /** The page is handing off to a gateway. */
  | { type: 'suqo:gateway' }
  /** Only when `debug` is on: something the page logged, threw, or requested. */
  | { type: 'suqo:debug'; level: string; text: string }
  /**
   * The session cannot be paid at all. Not a payment outcome — nothing was attempted.
   *
   * The page renders its own explanation and the buyer dismisses, so this changes nothing
   * about the sheet; it exists so the reason reaches the merchant's event stream.
   */
  | { type: 'suqo:unavailable'; reason: UnavailableReason }
  /** The payment settled, and the page has already verified it with the backend. */
  | {
      type: 'suqo:result'
      status: 'success' | 'failed' | 'cancelled'
      params: ReturnParams
      message?: string
    }

/** Narrowed from the event union, so the two cannot drift. */
type UnavailableReason = Extract<SuqoEvent, { type: 'unavailable' }>['reason']

const RESULT_STATUSES = new Set(['success', 'failed', 'cancelled'])

const UNAVAILABLE_REASONS = new Set<string>([
  'not-found',
  'expired',
  'spent',
  'no-customer',
  'no-methods',
  'load-failed',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Narrows the gateway's return params to string values.
 *
 * Values arrive as whatever the page put in them; anything non-primitive is dropped rather
 * than stringified into `"[object Object]"`, which would look like a real transaction
 * reference to code trying to reconcile one.
 */
function coerceParams(value: unknown): ReturnParams {
  if (!isRecord(value)) return {}
  const out: ReturnParams = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') out[key] = raw
    else if (typeof raw === 'number' || typeof raw === 'boolean') out[key] = String(raw)
  }
  return out
}

/**
 * Parses one `onMessage` payload, returning null for anything this SDK does not own.
 *
 * A WebView's message channel is shared with whatever the page chooses to post, so this is
 * the boundary that decides what counts as a protocol message. Unparseable JSON, a missing
 * `source`, or an unrecognised `type` are all normal traffic, not errors.
 */
export function parseInbound(raw: string): InboundMessage | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isRecord(data) || data.source !== MESSAGE_SOURCE) return null

  switch (data.type) {
    case 'suqo:alive':
      return { type: 'suqo:alive' }
    case 'suqo:ready':
      return { type: 'suqo:ready' }
    case 'suqo:gateway':
      return { type: 'suqo:gateway' }
    case 'suqo:resize': {
      const height = data.height
      // A non-finite or non-positive height would collapse the sheet. The page measures a
      // real element, so anything else means the measurement, not the sheet, is wrong.
      if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) return null
      return { type: 'suqo:resize', height }
    }
    case 'suqo:debug': {
      if (typeof data.text !== 'string') return null
      return {
        type: 'suqo:debug',
        level: typeof data.level === 'string' ? data.level : 'log',
        text: data.text,
      }
    }
    case 'suqo:result': {
      const status = data.status
      if (typeof status !== 'string' || !RESULT_STATUSES.has(status)) return null
      const message = typeof data.message === 'string' && data.message ? data.message : undefined
      return {
        type: 'suqo:result',
        status: status as 'success' | 'failed' | 'cancelled',
        params: coerceParams(data.params),
        ...(message === undefined ? {} : { message }),
      }
    }
    case 'suqo:unavailable': {
      const reason = data.reason
      // An unrecognised reason is dropped rather than widened. Passing an arbitrary string
      // through would make the host's own `switch` non-exhaustive for a value we never send.
      if (typeof reason !== 'string' || !UNAVAILABLE_REASONS.has(reason)) return null
      return { type: 'suqo:unavailable', reason: reason as UnavailableReason }
    }
    // `suqo:redirect` lands here and is dropped, correctly. It exists for a plain WebView that
    // injects no bridge at all; under this SDK the page always sees a native host, opens the
    // gateway in this same window, and never asks anyone to navigate on its behalf.
    //
    // `suqo:intent` lands here too, also correctly. It exists for the browser SDK, where the
    // checkout frame is sandboxed and cannot navigate the merchant's page itself — so it asks
    // the host to forward a deeplink to the merchant's own code instead. Nothing here is
    // sandboxed: this WebView already navigates to a bank/wallet deeplink in the same window,
    // and `react-native-webview`'s own navigation interception (`classifyNavigation` in
    // `urls.ts`) lifts it to `Linking.openURL` without anyone having to ask. Handling this
    // message too would be a second, redundant path to the same OS picker.
    default:
      return null
  }
}
