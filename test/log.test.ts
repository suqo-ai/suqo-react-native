import { afterEach, describe, expect, it, vi } from 'vitest'

import { log, redactFields, redactString, setDebug } from '../src/log'

afterEach(() => {
  setDebug(false)
  vi.restoreAllMocks()
})

describe('redactString', () => {
  it('scrubs a session id out of a checkout url', () => {
    expect(redactString('https://test.suqo.ai/c/cks_9f2c41a8')).toBe('https://test.suqo.ai/c/<id>')
  })

  it('scrubs a session id out of the hosted checkout url too', () => {
    expect(redactString('https://test.suqo.ai/checkout/cks_9f2c41a8')).toBe(
      'https://test.suqo.ai/checkout/<id>'
    )
  })

  it('scrubs a bare session id in free text, where no key name could catch it', () => {
    // The shape-based half of redaction, and the reason it exists. Session ids are not
    // UUID-shaped, so before this pattern was added a `cks_…` interpolated into a backend
    // error string printed in full while a subscription UUID in the same position did not.
    expect(redactString('session cks_9f2c41a8 is already spent')).toBe(
      'session <id> is already spent'
    )
  })

  it('still scrubs a subscription-shaped uuid out of a url', () => {
    expect(redactString('https://test.suqo.ai/c/4d7edf60-caef-427d-bcdc-b621e6c1ef85')).toBe(
      'https://test.suqo.ai/c/<id>'
    )
  })

  it('scrubs a bare uuid embedded in free text', () => {
    // Ids leak inside interpolated messages and inside backend error strings, where no key
    // name exists to deny-list.
    expect(redactString('failed for 4d7edf60-caef-427d-bcdc-b621e6c1ef85 at step 2')).toBe(
      'failed for <id> at step 2'
    )
  })

  it('scrubs a query string wholesale', () => {
    expect(redactString('https://test.suqo.ai/payment-success?pidx=bZQL&order=4417')).toBe(
      'https://test.suqo.ai/payment-success?<params>'
    )
  })
})

describe('redactFields', () => {
  it('scrubs by key name', () => {
    expect(redactFields({ sessionId: 'sub-1', params: { pidx: 'x' } })).toEqual({
      sessionId: '<redacted>',
      params: '<redacted>',
    })
  })

  it('scrubs by value shape under a key it does not know', () => {
    expect(redactFields({ note: 'see 4d7edf60-caef-427d-bcdc-b621e6c1ef85' })).toEqual({
      note: 'see <id>',
    })
  })

  it('leaves non-string values alone', () => {
    expect(redactFields({ height: 412, ok: true })).toEqual({ height: 412, ok: true })
  })
})

describe('log', () => {
  it('prints nothing unless debug is on', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    log('event', { sessionId: 'sub-1' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('redacts before the enabled check, so debug output cannot leak what default output would not', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    setDebug(true)
    log('event', { sessionId: 'sub-1', url: 'https://x/c/sub-1' })

    const printed = JSON.stringify(spy.mock.calls)
    expect(printed).not.toContain('sub-1')
    expect(printed).toContain('<redacted>')
  })
})
