import { describe, expect, it } from 'vitest'

import { SuqoConfigError } from '../src/errors'
import {
  buildCheckoutUrl,
  classifyNavigation,
  isAppHandoff,
  LIVE_ORIGIN,
  resolveBaseUrl,
  SANDBOX_ORIGIN,
} from '../src/urls'

describe('buildCheckoutUrl', () => {
  it('builds the default embedded checkout route', () => {
    expect(buildCheckoutUrl('https://test.suqo.ai', 'abc-123')).toBe(
      'https://test.suqo.ai/c/abc-123'
    )
  })

  it('tolerates a trailing slash on the base url', () => {
    expect(buildCheckoutUrl('https://test.suqo.ai/', 'abc-123')).toBe(
      'https://test.suqo.ai/c/abc-123'
    )
  })

  it('substitutes :id anywhere in a custom path', () => {
    expect(buildCheckoutUrl('https://test.suqo.ai', 'abc', '/ec/:id')).toBe(
      'https://test.suqo.ai/ec/abc'
    )
  })

  it('appends the id to a custom path that has no :id placeholder', () => {
    expect(buildCheckoutUrl('https://test.suqo.ai', 'abc', '/ec')).toBe(
      'https://test.suqo.ai/ec/abc'
    )
  })

  it('percent-encodes the subscription id', () => {
    expect(buildCheckoutUrl('https://test.suqo.ai', 'a b/c')).toBe(
      'https://test.suqo.ai/c/a%20b%2Fc'
    )
  })

  it('appends nothing to the query string', () => {
    // NPS appends its own return params with a literal `?` rather than `&`, so anything in
    // the query string comes back mangled and swallows the gateway's transaction id.
    expect(buildCheckoutUrl('https://test.suqo.ai', 'abc')).not.toContain('?')
  })

  it('refuses a non-http base url', () => {
    expect(() => buildCheckoutUrl('javascript:alert(1)', 'abc')).toThrow(SuqoConfigError)
    expect(() => buildCheckoutUrl('test.suqo.ai', 'abc')).toThrow(SuqoConfigError)
  })

  it('refuses a blank subscription id', () => {
    expect(() => buildCheckoutUrl('https://test.suqo.ai', '  ')).toThrow(SuqoConfigError)
  })
})

describe('resolveBaseUrl', () => {
  it('defaults to the sandbox origin when neither baseUrl nor mode is given', () => {
    expect(resolveBaseUrl(undefined)).toBe(SANDBOX_ORIGIN)
    expect(resolveBaseUrl(undefined, undefined)).toBe(SANDBOX_ORIGIN)
  })

  it('picks the origin for mode when no explicit baseUrl is given', () => {
    expect(resolveBaseUrl(undefined, 'live')).toBe(LIVE_ORIGIN)
    expect(resolveBaseUrl(undefined, 'sandbox')).toBe(SANDBOX_ORIGIN)
    expect(resolveBaseUrl('', 'live')).toBe(LIVE_ORIGIN)
  })

  it('lets an explicit baseUrl override mode', () => {
    expect(resolveBaseUrl('http://localhost:8787', 'live')).toBe('http://localhost:8787')
  })
})

describe('classifyNavigation', () => {
  it('allows http and https', () => {
    expect(classifyNavigation('https://test.suqo.ai/c/x')).toEqual({
      kind: 'allow',
    })
    expect(classifyNavigation('http://localhost:3000/x')).toEqual({ kind: 'allow' })
  })

  it('allows the return pages, which must load so they can verify', () => {
    // Reading the outcome off the return URL instead would skip the verification call that
    // page makes, and report a payment nobody confirmed.
    expect(classifyNavigation('https://test.suqo.ai/payment-success?pidx=abc')).toEqual({
      kind: 'allow',
    })
    expect(classifyNavigation('https://test.suqo.ai/payment-failure?status=cancelled')).toEqual({
      kind: 'allow',
    })
  })

  it('allows about:blank, the initial load', () => {
    expect(classifyNavigation('about:blank')).toEqual({ kind: 'allow' })
  })

  it('allows a scheme-less, same-document navigation', () => {
    expect(classifyNavigation('/payment-success')).toEqual({ kind: 'allow' })
  })

  it('hands a wallet deeplink to the OS', () => {
    expect(classifyNavigation('fonepayApp://payment/?emandate=abc%3D%3D')).toEqual({
      kind: 'handoff',
      scheme: 'fonepayapp',
    })
  })

  it('hands an Android intent url to the OS', () => {
    expect(classifyNavigation('intent://payment/?emandate=x#Intent;scheme=fonepayApp;end')).toEqual(
      { kind: 'handoff', scheme: 'intent' }
    )
  })

  it('blocks schemes with no business in a payment flow', () => {
    expect(classifyNavigation('javascript:alert(1)')).toEqual({
      kind: 'block',
      scheme: 'javascript',
    })
    expect(classifyNavigation('data:text/html,<h1>x')).toEqual({ kind: 'block', scheme: 'data' })
    expect(classifyNavigation('file:///etc/passwd')).toEqual({ kind: 'block', scheme: 'file' })
  })

  it('never hands a blocked scheme to the OS', () => {
    expect(isAppHandoff('javascript:alert(1)')).toBe(false)
    expect(isAppHandoff('data:text/html,x')).toBe(false)
  })
})
