import { Linking } from 'react-native'
import { beforeEach, describe, expect, it } from 'vitest'

import { intentTargets, isIntentUrl, openExternal } from '../src/handoff'

beforeEach(() => {
  Linking.reset()
})

describe('isIntentUrl', () => {
  it('recognises both forms and nothing else', () => {
    expect(isIntentUrl('intent://pay/?q=1#Intent;scheme=x;end')).toBe(true)
    expect(isIntentUrl('intent:pay#Intent;scheme=x;end')).toBe(true)
    expect(isIntentUrl('INTENT://pay#Intent;scheme=x;end')).toBe(true)
    expect(isIntentUrl('  intent://pay#Intent;scheme=x;end')).toBe(true)

    expect(isIntentUrl('fonepayApp://payment/?emandate=abc')).toBe(false)
    expect(isIntentUrl('https://app.suqo.ai/c/cks_1')).toBe(false)
    // A scheme that merely starts with the same letters.
    expect(isIntentUrl('intentional://pay')).toBe(false)
  })
})

describe('intentTargets', () => {
  it('rebuilds the deeplink the gateway meant', () => {
    expect(
      intentTargets('intent://payment/?qrPayload=abc%3D%3D#Intent;scheme=fonepayApp;end')
    ).toEqual(['fonepayApp://payment/?qrPayload=abc%3D%3D'])
  })

  it('keeps the body intact on the authority-less form', () => {
    // Sliced at a fixed `intent://` length this loses the leading `pa`.
    expect(intentTargets('intent:payment/?q=1#Intent;scheme=fonepayApp;end')).toEqual([
      'fonepayApp://payment/?q=1',
    ])
  })

  it('returns the browser fallback after the deeplink', () => {
    const fallback = 'https://play.google.com/store/apps/details?id=com.f1soft.esewa'
    expect(
      intentTargets(
        `intent://pay#Intent;scheme=fonepayApp;package=com.f1soft.esewa;S.browser_fallback_url=${encodeURIComponent(fallback)};end`
      )
    ).toEqual(['fonepayApp://pay', fallback])
  })

  it('drops a non-http fallback', () => {
    // The one field naming a whole URL, so the one a hostile page reaches for.
    expect(
      intentTargets(
        `intent://pay#Intent;scheme=fonepayApp;S.browser_fallback_url=${encodeURIComponent('javascript:alert(1)')};end`
      )
    ).toEqual(['fonepayApp://pay'])
  })

  it('drops an undecodable fallback without losing the deeplink', () => {
    expect(
      intentTargets('intent://pay#Intent;scheme=fonepayApp;S.browser_fallback_url=%ZZ;end')
    ).toEqual(['fonepayApp://pay'])
  })

  it('names no target when the fragment carries no scheme', () => {
    expect(intentTargets('intent://pay#Intent;package=com.x;end')).toEqual([])
    expect(intentTargets('intent://pay')).toEqual([])
  })

  it('returns nothing for a url that is not an intent uri', () => {
    expect(intentTargets('fonepayApp://pay')).toEqual([])
  })
})

describe('openExternal', () => {
  it('never hands a raw intent url to Linking', async () => {
    // The bug this exists for: React Native builds Intent(ACTION_VIEW, Uri.parse(url)) and
    // never Intent.parseUri, so `intent:` resolves to nothing on a real device.
    const opened = await openExternal('intent://payment/?q=1#Intent;scheme=fonepayApp;end')

    expect(opened).toBe(true)
    expect(Linking.opened).toEqual(['fonepayApp://payment/?q=1'])
  })

  it('falls back to the browser url when no app claims the deeplink', async () => {
    const fallback = 'https://play.google.com/store/apps/details?id=com.f1soft.esewa'
    Linking.failUrls = ['fonepayApp://pay']

    const opened = await openExternal(
      `intent://pay#Intent;scheme=fonepayApp;S.browser_fallback_url=${encodeURIComponent(fallback)};end`
    )

    expect(opened).toBe(true)
    expect(Linking.opened).toEqual([fallback])
  })

  it('reports failure when every candidate is refused', async () => {
    const fallback = 'https://play.google.com/store/apps/details?id=com.f1soft.esewa'
    Linking.openURLError = new Error('no activity found')

    const opened = await openExternal(
      `intent://pay#Intent;scheme=fonepayApp;S.browser_fallback_url=${encodeURIComponent(fallback)};end`
    )

    expect(opened).toBe(false)
    expect(Linking.opened).toEqual([])
  })

  it('reports failure when the intent url names no target at all', async () => {
    expect(await openExternal('intent://pay#Intent;package=com.x;end')).toBe(false)
    expect(Linking.opened).toEqual([])
  })

  it('refuses a rebuilt candidate on a blocked scheme', async () => {
    // A gateway page is not SUQO's, and `scheme=file` would otherwise reach Linking.
    const opened = await openExternal('intent://etc/passwd#Intent;scheme=file;end')

    expect(opened).toBe(false)
    expect(Linking.opened).toEqual([])
  })

  it('passes a plain custom scheme through untouched', async () => {
    expect(await openExternal('fonepayApp://payment/?emandate=abc')).toBe(true)
    expect(Linking.opened).toEqual(['fonepayApp://payment/?emandate=abc'])
  })
})
