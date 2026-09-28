/**
 * Payment-screen behaviour, rendered through `react-test-renderer` against the stubs in
 * `./stubs`.
 */
import { createElement, useEffect } from 'react'
import { act, create } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Linking } from 'react-native'
import { webViewSpy } from 'react-native-webview'

import { MESSAGE_SOURCE } from '../src/bridge'
import { SuqoProvider, useSuqoCheckout } from '../src/index'
import type { SuqoCheckoutOptions, SuqoEvent, SuqoOutcome } from '../src/types'

/** Opens a checkout as soon as it mounts, and hands the promise back to the test. */
function Opener({
  options,
  onPromise,
}: {
  options: SuqoCheckoutOptions
  onPromise(promise: Promise<SuqoOutcome>): void
}) {
  const { open, close } = useSuqoCheckout()
  useEffect(() => {
    onPromise(open(options))
    return () => close()
  }, [])
  return null
}

let tree: ReactTestRenderer | null = null

/** Mounts a provider whose child opens a checkout immediately. */
function mount(
  options: Partial<SuqoCheckoutOptions> = {},
  providerProps: { onEvent?: (event: SuqoEvent) => void; loadingLabel?: string } = {}
): Promise<SuqoOutcome> {
  let promise!: Promise<SuqoOutcome>

  act(() => {
    tree = create(
      createElement(SuqoProvider, {
        baseUrl: 'https://test.suqo.ai',
        ...providerProps,
        children: createElement(Opener, {
          options: { sessionId: 'cks_1', ...options },
          onPromise: (p: Promise<SuqoOutcome>) => {
            promise = p
          },
        }),
      })
    )
  })

  return promise
}

/** The live WebView's props, as the stub last recorded them. */
const webView = () => {
  if (!webViewSpy.props) throw new Error('no WebView mounted')
  return webViewSpy.props
}

const post = (body: Record<string, unknown>) => {
  act(() => {
    webView().onMessage?.({
      nativeEvent: { data: JSON.stringify({ source: MESSAGE_SOURCE, ...body }) },
    })
  })
}

/** Fires the Modal's Android-back handler. */
const hardwareBack = () => {
  if (!tree) throw new Error('nothing mounted')
  const modal = tree.root.findAll((node) => String(node.type) === 'Modal', { deep: true })[0]
  const props = modal?.props as { onRequestClose?: () => void } | undefined
  act(() => {
    props?.onRequestClose?.()
  })
}

/** Presses the header's back button. */
const pressBack = () => {
  if (!tree) throw new Error('nothing mounted')
  const button = tree.root.findAll(
    (node) =>
      String(node.type) === 'Pressable' &&
      (node.props as { accessibilityLabel?: string }).accessibilityLabel === 'Go back',
    { deep: true }
  )[0]
  const props = button?.props as { onPress?: () => void } | undefined
  if (!props?.onPress) throw new Error('no back button found')
  act(() => {
    props.onPress?.()
  })
}

beforeEach(() => {
  webViewSpy.reset()
  Linking.reset()
})

afterEach(() => {
  tree = null
  vi.useRealTimers()
})

describe('opening', () => {
  it('loads the embedded checkout route for the session', () => {
    mount()
    expect(webView().source.uri).toBe('https://test.suqo.ai/c/cks_1')
  })

  it('rejects a second concurrent checkout rather than stacking sheets', async () => {
    // Both calls have to go through the *same* provider — that is where the single sheet
    // lives, and the guard exists because two payments at once would either steal each
    // other's WebView or sit invisibly behind one another.
    const promises: Promise<SuqoOutcome>[] = []

    function TwiceOpener() {
      const { open } = useSuqoCheckout()
      useEffect(() => {
        promises.push(open({ sessionId: 'cks_1' }))
        promises.push(open({ sessionId: 'cks_2' }))
      }, [])
      return null
    }

    act(() => {
      tree = create(
        createElement(SuqoProvider, {
          baseUrl: 'https://test.suqo.ai',
          children: createElement(TwiceOpener),
        })
      )
    })

    await expect(promises[1]).rejects.toThrow(/already open/)
    expect(webViewSpy.mounts).toBe(1)
    expect(webView().source.uri).toBe('https://test.suqo.ai/c/cks_1')
  })

  it('reports a verified success once', async () => {
    const onSuccess = vi.fn()
    const promise = mount({ onSuccess })

    post({ type: 'suqo:alive' })
    post({ type: 'suqo:ready' })
    post({ type: 'suqo:result', status: 'success', params: { pidx: 'bZQL' }, message: 'ok' })

    await expect(promise).resolves.toMatchObject({ result: 'success', params: { pidx: 'bZQL' } })
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('reports a duplicate result once', async () => {
    const onSuccess = vi.fn()
    const promise = mount({ onSuccess })

    post({ type: 'suqo:result', status: 'success', params: {} })
    post({ type: 'suqo:result', status: 'success', params: {} })

    await promise
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('reports a cancellation as a failure with status cancelled', async () => {
    const onFailure = vi.fn()
    const promise = mount({ onFailure })

    post({ type: 'suqo:result', status: 'cancelled', params: { status: 'cancelled' } })

    await promise
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }))
  })

  it('lets a verified success arriving during the exit animation win over the dismissal', async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    const promise = mount({ onSuccess, onClose })

    // The stub's animations complete synchronously, so this is the ordering a real device
    // reaches when the page reports a verified payment a frame after the back press.
    pressBack()
    post({ type: 'suqo:result', status: 'success', params: { pidx: 'bZQL' } })

    await promise
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

describe('dismissing', () => {
  it('reports a close when the back button is pressed', async () => {
    const onClose = vi.fn()
    const promise = mount({ onClose })

    pressBack()

    await expect(promise).resolves.toMatchObject({ result: 'closed' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Android hardware back', async () => {
    const promise = mount()
    hardwareBack()
    await expect(promise).resolves.toMatchObject({ result: 'closed' })
  })

  it('reports exactly one outcome when dismissed twice', async () => {
    const onClose = vi.fn()
    const promise = mount({ onClose })
    pressBack()
    hardwareBack()
    await promise
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('is presented full screen, not as a sheet', () => {
    mount()
    const modal = tree?.root.findAll((node) => String(node.type) === 'Modal', { deep: true })[0]
    expect((modal?.props as { presentationStyle?: string }).presentationStyle).toBe('fullScreen')
  })
})

describe('the WebView', () => {
  it('mounts exactly once across the whole flow', () => {
    // The invariant most easily broken by a refactor, and the one whose breakage only shows
    // up against a real gateway: a remount reloads the page and discards the buyer's
    // payment session mid-flow.
    mount()
    expect(webViewSpy.mounts).toBe(1)

    post({ type: 'suqo:alive' })
    post({ type: 'suqo:ready' })
    post({ type: 'suqo:resize', height: 300 })
    post({ type: 'suqo:resize', height: 520 })
    post({ type: 'suqo:gateway' })

    expect(webViewSpy.mounts).toBe(1)
  })

  it('lets a return page load, because that page is what verifies the payment', () => {
    mount()
    expect(
      webView().onShouldStartLoadWithRequest?.({
        url: 'https://test.suqo.ai/payment-success?pidx=x',
      })
    ).toBe(true)
  })

  it('hands a wallet deeplink to the OS and refuses to load it', async () => {
    mount()

    const allowed = webView().onShouldStartLoadWithRequest?.({
      url: 'fonepayApp://payment/?emandate=abc',
    })

    expect(allowed).toBe(false)
    // The handoff is a promise chain inside the handler.
    await act(async () => {})
    expect(Linking.opened).toEqual(['fonepayApp://payment/?emandate=abc'])
  })

  it('hands an Android intent url to the OS', async () => {
    mount()
    webView().onShouldStartLoadWithRequest?.({
      url: 'intent://payment/?emandate=x#Intent;scheme=fonepayApp;end',
    })
    await act(async () => {})
    expect(Linking.opened).toHaveLength(1)
  })

  it('hands off even when canOpenURL says no', async () => {
    // Android 11+ answers false for any scheme the host app has not declared in its
    // manifest queries, which this package cannot add on a consumer's behalf. Failing
    // closed turns that into a launch attempt rather than a dead end.
    Linking.canOpenURLResult = false
    mount()
    webView().onShouldStartLoadWithRequest?.({ url: 'fonepayApp://payment/?x=1' })
    await act(async () => {})
    expect(Linking.opened).toEqual(['fonepayApp://payment/?x=1'])
  })

  it('reports a failed handoff without settling the payment', async () => {
    Linking.openURLError = new Error('no activity found')
    const onEvent = vi.fn()
    const onClose = vi.fn()
    mount({ onClose }, { onEvent })

    webView().onShouldStartLoadWithRequest?.({ url: 'fonepayApp://payment/?x=1' })
    await act(async () => {})

    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'handoff_failed' }))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('blocks a javascript: navigation and hands it to nothing', async () => {
    mount()
    expect(webView().onShouldStartLoadWithRequest?.({ url: 'javascript:alert(1)' })).toBe(false)
    await act(async () => {})
    expect(Linking.opened).toEqual([])
  })

  it('collapses window.open into this window, so no handle is ever needed', () => {
    mount()
    expect(webView().setSupportMultipleWindows).toBe(false)
  })

  it('keeps DOM storage on — the page holds its scoped payment token there', () => {
    mount()
    expect(webView().domStorageEnabled).toBe(true)
  })
})

describe('load deadlines', () => {
  it('gives up on a page that never reports alive', () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()

    mount({}, { onEvent })
    act(() => {
      vi.advanceTimersByTime(12_000)
    })

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'load_timeout', stage: 'alive' })
    )
  })

  it('gives up on a page that reports alive but never becomes ready', () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()

    mount({}, { onEvent })
    post({ type: 'suqo:alive' })
    act(() => {
      vi.advanceTimersByTime(25_000)
    })

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'load_timeout', stage: 'ready' })
    )
    // The alive deadline must have been disarmed by the alive message.
    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'load_timeout', stage: 'alive' })
    )
  })

  it('does not fire a deadline once the block is ready', () => {
    vi.useFakeTimers()
    const onEvent = vi.fn()

    mount({}, { onEvent })
    post({ type: 'suqo:alive' })
    post({ type: 'suqo:ready' })
    act(() => {
      vi.advanceTimersByTime(120_000)
    })

    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'load_timeout' }))
  })

  it('does not settle the payment when a deadline elapses', async () => {
    vi.useFakeTimers()
    const onFailure = vi.fn()
    const onClose = vi.fn()
    mount({ onFailure, onClose })

    act(() => {
      vi.advanceTimersByTime(60_000)
    })

    // A page that failed to load is a loading failure, not a payment failure: nothing has
    // been attempted, so inventing an outcome here would be a lie either way.
    expect(onFailure).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('the loading state', () => {
  /** The spinner the loading state renders, if it is on screen at all. */
  const spinner = () => {
    if (!tree) throw new Error('nothing mounted')
    return tree.root.findAll((node) => String(node.type) === 'ActivityIndicator', {
      deep: true,
    })[0]
  }

  /** The overlay View the spinner and its label sit in. */
  const overlay = () => {
    if (!tree) throw new Error('nothing mounted')
    return tree.root.findAll(
      (node) =>
        String(node.type) === 'View' &&
        (node.props as { style?: { position?: string } }).style?.position === 'absolute',
      { deep: true }
    )[0]
  }

  const overlayStyle = () => overlay()?.props.style as Record<string, unknown> | undefined

  /** Every line of copy the loading state renders. */
  const labels = () =>
    overlay()
      ?.findAll((node) => String(node.type) === 'Text', { deep: true })
      .map((node) => node.children.join('')) ?? []

  it('covers the whole screen while the page loads', () => {
    mount()

    const style = overlayStyle()

    // Written out rather than asserted as "absoluteFillObject", because that spread is
    // exactly what failed: with only `position: 'absolute'` reaching the native side the
    // overlay lays out as a strip at the foot of the screen, the page shows through above
    // it, and the spinner reads as a stray artefact sitting under the payment block.
    expect(style).toMatchObject({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 })
  })

  it('labels the spinner, and takes the wording from the provider', () => {
    mount({}, { loadingLabel: 'Kripaya pratiksha garnuhos' })

    expect(labels()).toEqual(['Kripaya pratiksha garnuhos'])
  })

  it('renders the spinner alone when the label is blank', () => {
    mount({}, { loadingLabel: '' })

    // An empty string is a host asking for no copy, not a host forgetting to pass any — the
    // default is what covers that. Rendering it would draw an empty line under the spinner.
    expect(spinner()).toBeDefined()
    expect(labels()).toEqual([])
  })

  it('is gone once the block reports ready', () => {
    mount()
    post({ type: 'suqo:alive' })
    post({ type: 'suqo:ready' })

    expect(spinner()).toBeUndefined()
  })
})
