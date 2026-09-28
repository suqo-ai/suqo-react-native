import { memo } from 'react'
import type { MutableRefObject } from 'react'
import { StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'

import { parseInbound } from '../bridge'
import type { InboundMessage } from '../bridge'
import { log } from '../log'
import { classifyNavigation } from '../urls'

export interface WebViewHandlers {
  onMessage(message: InboundMessage): void
  onHandoff(url: string, scheme: string): void
  onLoadEnd(): void
  onLoadError(): void
}

interface Props {
  url: string
  /** Injected before content loads when `debug` is on. Empty otherwise. */
  debugScript: string
  /**
   * A ref, not plain props.
   *
   * The component is memoised on `url` alone so that nothing about the sheet's own state —
   * height, spinner, drag position — can cause a re-render here. Callbacks passed by value
   * would defeat that, or go stale if compared away. A ref keeps one stable identity whose
   * contents the parent refreshes every render.
   */
  handlers: MutableRefObject<WebViewHandlers>
}

function CheckoutWebViewInner({ url, debugScript, handlers }: Props) {
  return (
    <WebView
      source={{ uri: url }}
      // Transparent ground: the block sits inside the sheet, and a white flash on load
      // reads as a layout jump on the way in.
      style={styles.webView}
      // Before content, so a failure during the page's own boot is caught too. Empty string
      // when debug is off, which the library treats as no injection. This is the only script
      // this SDK injects — the page needs nothing handed to it.
      injectedJavaScriptBeforeContentLoaded={debugScript}
      onMessage={(event) => {
        const message = parseInbound(event.nativeEvent.data)
        // Not ours: a WebView's message channel is shared with whatever the page posts.
        if (!message) return
        handlers.current.onMessage(message)
      }}
      // Everything is routed through our own classification rather than left to the
      // library's default, which hands non-matching origins straight to the OS. Bank
      // deeplinks must reach `Linking`, but `javascript:` and `data:` must reach nothing.
      originWhitelist={['*']}
      onShouldStartLoadWithRequest={(request) => shouldLoad(request.url, handlers)}
      // Android can bypass the handler above on a same-page redirect, which is exactly how
      // some gateways bounce to a bank app. Mirroring it here is what the SUQO buyer app
      // does for the same reason; a double call is harmless because handoffs are idempotent
      // and the settle path latches.
      onNavigationStateChange={(state) => {
        shouldLoad(state.url, handlers)
      }}
      onLoadEnd={() => handlers.current.onLoadEnd()}
      onError={() => handlers.current.onLoadError()}
      onHttpError={() => handlers.current.onLoadError()}
      // `window.open` collapses into a same-window navigation. The checkout page opens the
      // gateway in this window when it detects a React Native host, but a page that has not
      // been updated yet would otherwise open a window with no handle and strand the buyer.
      setSupportMultipleWindows={false}
      javaScriptEnabled
      // The checkout page keeps its scoped payment token in `localStorage`. Without this,
      // Android has no storage to keep it in and every payment call is unauthenticated.
      domStorageEnabled
      thirdPartyCookiesEnabled
      sharedCookiesEnabled
      // The sheet owns vertical gestures. Leaving the WebView's own overscroll on makes the
      // page fight the drag-to-dismiss.
      bounces={false}
      overScrollMode="never"
    />
  )
}

/** Shared by both navigation handlers. Returns whether the WebView should load `url`. */
function shouldLoad(url: string, handlers: MutableRefObject<WebViewHandlers>): boolean {
  const navigation = classifyNavigation(url)

  if (navigation.kind === 'handoff') {
    handlers.current.onHandoff(url, navigation.scheme)
    return false
  }

  if (navigation.kind === 'block') {
    log('nav.blocked', { scheme: navigation.scheme })
    return false
  }

  return true
}

const styles = StyleSheet.create({
  webView: { flex: 1, backgroundColor: 'transparent' },
})

/**
 * Memoised on the URL, so the WebView mounts **once** per `open()`.
 *
 * A remount reloads the checkout page, and if the buyer is already at a gateway that means
 * their payment session is discarded mid-flow — a failure that only shows up against a real
 * gateway, which is why the mount count is asserted in the test suite.
 */
export const CheckoutWebView = memo(
  CheckoutWebViewInner,
  (prev, next) => prev.url === next.url && prev.debugScript === next.debugScript
)
