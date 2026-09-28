import { describe, expect, it } from 'vitest'

import { buildDebugScript, MESSAGE_SOURCE, parseInbound } from '../src/bridge'

/** A message as the WebView delivers it: the envelope, serialised. */
const envelope = (body: Record<string, unknown>) =>
  JSON.stringify({ source: MESSAGE_SOURCE, ...body })

describe('buildDebugScript', () => {
  it('ends with a final expression so iOS does not warn', () => {
    // Salvaged from the init script's suite when that was deleted. `injectedJavaScript` that
    // evaluates to undefined makes iOS log a warning on every injection, and this is now the
    // only script this SDK injects — so it is the only place the constraint can be pinned.
    expect(buildDebugScript().trimEnd().endsWith('true;')).toBe(true)
  })

  it('guards against re-entry, because the library re-injects on every navigation', () => {
    expect(buildDebugScript()).toContain('window.__suqoDebug')
  })

  it('carries the envelope every message in this protocol is tagged with', () => {
    expect(buildDebugScript()).toContain(MESSAGE_SOURCE)
  })
})

describe('parseInbound', () => {
  it('parses an unavailable session, which is not a payment outcome', () => {
    expect(parseInbound(envelope({ type: 'suqo:unavailable', reason: 'no-customer' }))).toEqual({
      type: 'suqo:unavailable',
      reason: 'no-customer',
    })
  })

  it('drops a reason it does not recognise rather than widening the union', () => {
    expect(parseInbound(envelope({ type: 'suqo:unavailable', reason: 'vibes' }))).toBeNull()
  })

  it('drops suqo:redirect, which cannot apply to this host', () => {
    // It exists for a plain WebView that injects no bridge. Under this SDK the page always
    // sees a native host, opens the gateway in this same window, and never asks anyone to
    // navigate for it — so acting on one would mean navigating to a page we are already on.
    expect(parseInbound(envelope({ type: 'suqo:redirect', url: 'https://x.test/y' }))).toBeNull()
  })

  it('parses the lifecycle messages', () => {
    expect(parseInbound(envelope({ type: 'suqo:alive' }))).toEqual({ type: 'suqo:alive' })
    expect(parseInbound(envelope({ type: 'suqo:ready' }))).toEqual({ type: 'suqo:ready' })
    expect(parseInbound(envelope({ type: 'suqo:gateway' }))).toEqual({ type: 'suqo:gateway' })
  })

  it('parses a resize', () => {
    expect(parseInbound(envelope({ type: 'suqo:resize', height: 412 }))).toEqual({
      type: 'suqo:resize',
      height: 412,
    })
  })

  it('drops a resize that would collapse the sheet', () => {
    expect(parseInbound(envelope({ type: 'suqo:resize', height: 0 }))).toBeNull()
    expect(parseInbound(envelope({ type: 'suqo:resize', height: -10 }))).toBeNull()
    expect(parseInbound(envelope({ type: 'suqo:resize', height: 'tall' }))).toBeNull()
    expect(parseInbound(envelope({ type: 'suqo:resize' }))).toBeNull()
  })

  it('parses a result and keeps the gateway params verbatim', () => {
    const message = parseInbound(
      envelope({
        type: 'suqo:result',
        status: 'success',
        params: { pidx: 'bZQL', purchase_order_id: '4417' },
        message: 'Payment verified',
      })
    )
    expect(message).toEqual({
      type: 'suqo:result',
      status: 'success',
      params: { pidx: 'bZQL', purchase_order_id: '4417' },
      message: 'Payment verified',
    })
  })

  it('keeps cancelled distinct from failed', () => {
    expect(
      parseInbound(envelope({ type: 'suqo:result', status: 'cancelled', params: {} }))
    ).toEqual({
      type: 'suqo:result',
      status: 'cancelled',
      params: {},
    })
  })

  it('omits message when the backend said nothing', () => {
    const message = parseInbound(envelope({ type: 'suqo:result', status: 'failed', params: {} }))
    expect(message && 'message' in message).toBe(false)
  })

  it('drops a result with an unknown status', () => {
    expect(parseInbound(envelope({ type: 'suqo:result', status: 'weird', params: {} }))).toBeNull()
  })

  it('stringifies primitive params and drops the rest', () => {
    const message = parseInbound(
      envelope({
        type: 'suqo:result',
        status: 'success',
        params: { a: 'x', b: 12, c: true, d: { nested: 1 }, e: null },
      })
    )
    // A nested object stringified to "[object Object]" would look like a real transaction
    // reference to code trying to reconcile one.
    expect(message).toMatchObject({ params: { a: 'x', b: '12', c: 'true' } })
    expect(message && 'd' in (message as { params: Record<string, string> }).params).toBe(false)
  })

  it('ignores traffic that is not ours', () => {
    expect(parseInbound('not json')).toBeNull()
    expect(parseInbound(JSON.stringify({ type: 'suqo:ready' }))).toBeNull()
    expect(parseInbound(JSON.stringify({ source: 'analytics', type: 'suqo:ready' }))).toBeNull()
    expect(parseInbound(envelope({ type: 'suqo:unknown' }))).toBeNull()
    expect(parseInbound(JSON.stringify('a string'))).toBeNull()
    expect(parseInbound(JSON.stringify(null))).toBeNull()
  })
})
