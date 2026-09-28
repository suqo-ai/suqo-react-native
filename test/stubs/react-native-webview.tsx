/**
 * A stand-in for `react-native-webview` that records every mount.
 *
 * The mount counter is the point: "the WebView must not remount" is the invariant most
 * easily broken by an innocuous refactor, and it produces a bug that only shows up against
 * a real gateway, where a remount silently discards the buyer's payment session.
 */
import { createElement, useEffect } from 'react'

export interface WebViewStubProps {
  source: { uri: string }
  injectedJavaScript?: string
  onMessage?: (event: { nativeEvent: { data: string } }) => void
  onShouldStartLoadWithRequest?: (request: { url: string }) => boolean
  onNavigationStateChange?: (state: { url: string }) => void
  onLoadEnd?: () => void
  onError?: () => void
  onHttpError?: () => void
  [key: string]: unknown
}

export const webViewSpy = {
  mounts: 0,
  /** The most recently mounted instance's props. */
  props: null as WebViewStubProps | null,
  reset() {
    webViewSpy.mounts = 0
    webViewSpy.props = null
  },
}

export function WebView(props: WebViewStubProps) {
  webViewSpy.props = props

  useEffect(() => {
    webViewSpy.mounts += 1
  }, [])

  return createElement('WebView', { testID: 'suqo-webview', uri: props.source.uri })
}
