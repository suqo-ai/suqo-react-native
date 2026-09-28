# Changelog

All notable changes to `@suqo/react-native` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this package follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0]

Keyed on checkout sessions instead of subscriptions. Every caller changes.

### Changed

- `open({ subscriptionId, customer })` is now `open({ sessionId })`. The session is created on
  your backend and already carries the buyer.
- The sheet loads `/c/<sessionId>`; `DEFAULT_CHECKOUT_PATH` is `'/c/:id'`.
- `SuqoSuccess`, `SuqoFailure`, `SuqoOutcome` and every `SuqoEvent` carry `sessionId` rather
  than `subscriptionId`.

### Removed

- `SuqoCustomer`, `REQUIRED_CUSTOMER_FIELDS`, and the `customer` option. Nothing about the
  buyer passes through this SDK any more.
- The `suqo:init` handshake and the script that injected it, including its 15-second retry
  loop. The protocol is one-directional now — the page needs nothing from us, and the only
  script still injected is the optional debug forwarder.
- `open()` no longer rejects for a missing buyer detail. It rejects for a checkout already
  open, or a session id and base URL that cannot produce a URL.
- `tools/rn-host.mjs`, whose only purpose was proving the handshake worked against a real page.

### Added

- A `suqo:unavailable` event carrying `not-found | expired | spent | no-customer | no-methods |
load-failed`. Deliberately an event and not a callback: no payment was attempted, so
  `onFailure` would be a lie. The buyer sees the page's own explanation and dismisses, which
  settles as `closed`.

### Fixed

- Session ids are redacted from debug output by shape. `cks_…` is not UUID-shaped, so the
  shape-based half of redaction — the half that catches an id interpolated into a backend error
  string, where no key name could — would otherwise have silently stopped working.

## [0.1.0] - 2026-09-08

### Added

- `SuqoProvider` and `useSuqoCheckout()`. One provider at the app root owns a single
  full-screen checkout screen; `open({ subscriptionId, customer, … })` shows it and reports
  the outcome through exactly one of `onSuccess`, `onFailure` or `onClose`. It also resolves
  a promise, so `await` works instead of callbacks.
- The screen is built from React Native core primitives — `Modal` and `Animated` — so
  `react-native-webview` is the only native dependency and the package works in Expo Go with
  no configuration. Presented as a full-screen modal rather than a route, so it needs no
  navigation library and no route registration, and Android's hardware back button dismisses
  it like any screen.
- The checkout block scrolls inside the screen, which a seller with NPS enabled needs: the
  bank list alone runs to about 1500px.
- `debug` forwards the page's own console output, errors and requests to the host's console.
  A WebView is otherwise opaque — a page that hangs and a page that threw look identical —
  and this is what located the handshake-timing bug below.
- The injected handshake retries until the page has hydrated. `injectedJavaScript` runs at
  page load, but the page installs its `suqo:init` listener during hydration, and
  `postMessage` does not queue for a listener that does not exist yet: a single post is lost
  and the page stays blank forever.
- Bank and wallet deeplinks (`fonepayApp://`, Android `intent://`) are lifted out of the
  WebView to `Linking.openURL`, which a WebView cannot resolve itself. `javascript:`,
  `data:`, `file:` and `blob:` navigations are refused outright.
- Gateway return pages are allowed to load, because that is where the payment is verified.
  The outcome is taken from the page's own `suqo:result` message, after verification.
- Two load deadlines (12s to first signal, 25s to the block mounting) with a retry, so a
  page that never boots reports a loading failure rather than hanging.
- Redacted, opt-in debug logging behind `debug`, plus an `onEvent` stream for the host's own
  logs.

### Requires

- The SUQO web app must route `postToHost` and `publishResult` through
  `window.ReactNativeWebView`, treat an RN host as a gateway window, and hand off to
  gateways in the same window. Without those, the checkout page loads but reports nothing.
