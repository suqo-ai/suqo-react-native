/**
 * The only module in this package permitted to call `console`.
 *
 * Everything routes through here because this is where redaction happens. A subscription id
 * identifies a payable thing and a gateway's return params carry transaction references; in
 * a host app's logs — or in a crash reporter's breadcrumbs, which scoop up console output —
 * neither belongs in the clear.
 *
 * Logging is off unless the host passes `debug` to `SuqoProvider`.
 *
 * @packageDocumentation
 */

let enabled = false

/** Turns SDK logging on or off. Called by `SuqoProvider`; not part of the public API. */
export function setDebug(on: boolean): void {
  enabled = on
}

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi

/**
 * Checkout session ids, which are not UUID-shaped.
 *
 * Without this the shape-based half of redaction quietly stops working: `UUID_RE` was the
 * only thing catching a bare id in free text, and a session id matches none of it. A backend
 * error string mentioning one would print in full.
 */
const SESSION_ID_RE = /\bcks_[A-Za-z0-9_-]+/g

/**
 * Scrubs identifiers out of a string by **shape**, not by the key that carried it.
 *
 * Shape-based is the load-bearing half: an id interpolated into a message, or embedded in a
 * backend error string, never arrives under a name we could deny-list.
 */
export function redactString(value: string): string {
  return value
    .replace(UUID_RE, '<id>')
    .replace(SESSION_ID_RE, '<id>')
    .replace(/(\/c\/)[^/?#\s]+/g, '$1<id>')
    .replace(/(\/checkout\/)[^/?#\s]+/g, '$1<id>')
    .replace(/(\/r\/)[^/?#\s]+/g, '$1<id>')
    .replace(/\?[^\s]*/g, '?<params>')
}

const REDACTED_KEYS = new Set(['sessionId', 'session_id', 'id', 'params', 'url', 'uri', 'message'])

/** Scrubs a field bag by key name **and** by value shape. Both, because either alone leaks. */
export function redactFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (REDACTED_KEYS.has(key)) {
      out[key] = '<redacted>'
    } else if (typeof value === 'string') {
      out[key] = redactString(value)
    } else {
      out[key] = value
    }
  }
  return out
}

/**
 * Emits one redacted log line.
 *
 * Redaction runs **before** the enabled check on purpose. Were it after, a redaction bug
 * would only ever manifest with debug on — which is precisely the configuration no test
 * runs in by default.
 */
export function log(event: string, fields?: Record<string, unknown>): void {
  const safe = fields ? redactFields(fields) : undefined
  if (!enabled) return
  // eslint-disable-next-line no-console
  console.log(`[suqo] ${event}`, safe ?? '')
}
