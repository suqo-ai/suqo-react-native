# Using `@suqo/react-native`

A guide for apps collecting a SUQO payment from React Native. For the wire protocol this
package implements against the SUQO web app, see `js-checkout/docs/protocol.md` in the
`js-checkout` repo — §8 and the "Host" checklist cover the native-host contract specifically.

## What it is

Your backend creates a **checkout session** through SUQO's API and hands your app its id. This
package opens SUQO's own checkout page for that id in a full-screen sheet, lets the buyer pay,
and tells you how it went.

It makes **no SUQO API calls of its own and holds no credential**. The gateway list, the
payment call, the hand-off to eSewa / Khalti / ConnectIPS / NPS, and the verification all
belong to the page inside the WebView. The session id is the only thing this package knows —
single-use, short-lived, and carrying no buyer details of its own — so nothing sensitive and
nothing long-lived ever sits in your app bundle.

**The session must already have a customer assigned when you create it.** This package has no
way to attach one — there is no buyer-detail field anywhere on `open()` — so a session created
without one mounts the sheet, shows the page's own "can't be paid" explanation, and reports
`onEvent({ type: 'unavailable', reason: 'no-customer' })` rather than ever reaching a payable
state. Assign the customer on your backend, through the checkout-session API, before you hand
the id to `open()`.

```
npm install @suqo/react-native react-native-webview
```

`react-native-webview` is the only native dependency — works in Expo Go and bare React Native
with no config plugin.

## Quick start

Mount the provider once, at your app root:

```tsx
import { SuqoProvider } from '@suqo/react-native'

export default function App() {
  return (
    <SuqoProvider mode="sandbox">
      <Navigation />
    </SuqoProvider>
  )
}
```

`mode="live"` points at `app.suqo.ai`; the default, `"sandbox"`, points at `test.suqo.ai` — so
an app that names neither cannot accidentally take a live payment. Pass `baseUrl` to go
somewhere else entirely (a staging mirror, a local mock server); it overrides `mode` when set.

Then open a payment from anywhere below it:

```tsx
import { useSuqoCheckout } from '@suqo/react-native'

function PayButton({ sessionId }) {
  const { open } = useSuqoCheckout()

  return (
    <Button
      title="Pay"
      onPress={() =>
        open({
          sessionId,
          onSuccess: ({ params, message }) => navigation.replace('Receipt', { params }),
          onFailure: ({ status, message }) => setError(status === 'cancelled' ? null : message),
          onClose: () => {},
        })
      }
    />
  )
}
```

**Exactly one of the three callbacks fires per `open()`.** `open()` also resolves with the
outcome, if you prefer `await` to callbacks:

```tsx
const outcome = await open({ sessionId })
if (outcome.result === 'success') {
  /* … */
}
```

## There is nothing about the buyer here

The checkout session is created on your own backend with your API key, and it must already
carry the buyer by the time you pass its id to `open()` — their name, email and address never
pass through this SDK, never reach the device, and never end up in a log, because there is
nothing for you to validate or supply here. Create the session with a customer attached; this
package cannot attach one for you.

`open()` rejects **before the sheet appears**, for exactly two reasons: a checkout is already
open, or the session id and base URL cannot produce a checkout URL.

## Programmatic API

```ts
const { open, close } = useSuqoCheckout()

open({
  sessionId: 'cks_9f2c41a8',
  onSuccess: (result) => {},  // { sessionId, params, message? }
  onFailure: (result) => {},  // { sessionId, status: 'failed' | 'cancelled', params, message? }
  onClose:   () => {},
}) // => Promise<SuqoOutcome>

close() // dismisses the sheet as though the buyer closed it — a no-op if nothing is open
```

`close()` settles the open session as `{ result: 'closed' }`, the same outcome a buyer gets
from the back button or a hardware back press — so a caller that drives both `open()` and
`close()` sees one consistent shape regardless of who ended the sheet.

A result that arrives from the page **after** you call `close()` (the buyer dismissed, but the
page had already verified the payment with the backend a frame later) still wins: a verified
result always beats an earlier dismissal, because telling the app "nothing happened" while the
buyer's money moved would be the one actionable lie this SDK could tell. Only one outcome is
ever delivered either way.

## `cancelled` is not `failed`

`onFailure` receives `status: 'cancelled'` when the buyer backed out at the gateway, and
`'failed'` when a payment was attempted and rejected. Check it: a buyer who changed their mind
wants the basket offered again, while a rejected payment is worth looking into. Nothing is
charged in either case.

## `params` is the gateway's, verbatim

Every gateway names its transaction differently — eSewa a signed `data` blob, Khalti a `pidx`,
ConnectIPS a `TXNID`, NPS a `MerchantTxnId`. `params` is passed through with no renaming or
filtering, because you reconcile against whatever your own backend recorded, and normalising
would throw away the only field you can match on.

`message` is what SUQO's backend said when it settled the payment — a separate argument so our
keys never mix into `params`. It is `undefined` when the backend said nothing, so it is never
copy this SDK invented; on a failure it is usually the only place the reason exists.

## The outcome is a signal to navigate, not proof of fulfilment

`onSuccess` fires only after the checkout page verified the payment with SUQO's backend, so
it is a real signal rather than a redirect's claim. Even so, **the webhook is authoritative**.
Treat `onSuccess` as "move the buyer on", and let your own backend decide an order is paid
from its own record.

## Options

| Prop           | Default                   | Notes                                                          |
| -------------- | -------------------------- | --------------------------------------------------------------- |
| `mode`         | `'sandbox'`                | `'live'` → `app.suqo.ai`, `'sandbox'` → `test.suqo.ai`.          |
| `baseUrl`      | —                          | Where SUQO's checkout is served from. Overrides `mode`.         |
| `checkoutPath` | `/c/:id`                   | The route, with `:id` for the checkout session id.               |
| `title`        | `Secure payment`           | Sheet header. The amount and seller are rendered by the page.    |
| `loadingLabel` | `Loading secure checkout`  | The line under the spinner. Pass `''` for a spinner alone.       |
| `insets`       | measured                   | See [Safe-area insets](#safe-area-insets--pass-them-if-you-can). |
| `debug`        | `false`                    | Turns on this package's redacted console logging.                |
| `onEvent`      | —                          | A debug stream for your own logs. Not a payment signal.          |

### Safe-area insets — pass them if you can

Without `insets` the screen measures the safe area with a **platform heuristic**: status-bar
height and a nav-bar estimate on Android, a home-indicator guess on iOS. It is a reasonable
default, not a solved problem.

If your app already has `react-native-safe-area-context`, pass real values:

```tsx
const insets = useSafeAreaInsets()

<SuqoProvider baseUrl={…} insets={{ top: insets.top, bottom: insets.bottom }}>
```

### `onEvent` — every shape it can send

`onEvent` is a debug stream, not a payment signal — use the callbacks on `open()` for that.
Every event carries `sessionId`:

| `type`           | When                                                          |
| ---------------- | -------------------------------------------------------------- |
| `open`           | `open()` was called and the sheet is about to show.             |
| `alive`          | The document loaded and ran scripts.                            |
| `ready`          | The payment block is on screen.                                 |
| `resize`         | `{ height }` — reported, but nothing here is sized by it.       |
| `gateway`        | The page is navigating this WebView to a gateway.                |
| `handoff`        | `{ scheme }` — a bank/wallet deeplink was handed to the OS.      |
| `handoff_failed` | `{ scheme }` — the OS had nothing registered to open it.         |
| `load_timeout`   | `{ stage: 'alive' \| 'ready' }` — a load deadline elapsed.       |
| `load_error`     | The WebView itself failed to load the page.                     |
| `unavailable`    | `{ reason }` — the session cannot be paid at all. See below.     |
| `settled`        | `{ outcome }` — the sheet's one outcome, mirrors what `open()` resolved with. |

### `unavailable` is an event, not a callback

`onUnavailable` does not exist on `open()`. When the session cannot be paid at all —
`'not-found'`, `'expired'`, `'spent'`, `'no-customer'`, `'no-methods'`, `'load-failed'` — the
page renders its own explanation and the buyer dismisses the sheet, which settles as `onClose`.
Routing it through `onFailure` would tell your app a payment was attempted and rejected, when
none was. Catch it via `onEvent({ type: 'unavailable', reason })` if you want to log *why* a
buyer saw an empty sheet — it is usually a sign your own integration created the session wrong
(most often an expired or already-used id, or — specific to this SDK — `'no-customer'`: the
session was created with no buyer attached, which this package has no field to supply after
the fact).

## Environments and exports

```ts
import {
  SuqoProvider, useSuqoCheckout,
  LIVE_ORIGIN, SANDBOX_ORIGIN, resolveBaseUrl, DEFAULT_CHECKOUT_PATH,
  SuqoConfigError, VERSION,
} from '@suqo/react-native'
```

`LIVE_ORIGIN` / `SANDBOX_ORIGIN` are the two origins `mode` picks between; `resolveBaseUrl`
is the same resolution `<SuqoProvider>` runs internally (`baseUrl`, else `mode`, defaulting to
sandbox), exported for anywhere else in your app that needs to build a SUQO URL consistently.
`SuqoConfigError` is what `open()` rejects with for both of its two failure reasons — check
`error instanceof SuqoConfigError` rather than matching its message.

## What the buyer sees

A full-height screen slides in with the SUQO payment block inside it: a back button, a title,
and the block filling the rest. The block scrolls — a seller with NPS enabled lists every
supported bank, which runs well past a phone screen.

It is presented as a full-screen `Modal`, not a route in your navigator — nothing to register,
no route name to agree on — and it still behaves like a pushed screen, including Android's
hardware back button. Back, hardware back, or `close()` all dismiss it and report `onClose`.

When the buyer's bank needs its own app, the screen hands the deeplink to the OS and the bank
app opens over yours. Coming back leaves the screen exactly as it was, mid-payment.

## Troubleshooting

**The sheet shows an error panel instead of the payment block.**
One of three load deadlines elapsed — the copy tells you which:

| Panel says | Deadline | Likely cause |
| --- | --- | --- |
| "Couldn't load the payment page" | the WebView itself never finished loading (`load_error`) | no connection, a blocked host |
| "Couldn't reach the payment page" | 12s, no `suqo:alive` | the document loaded but never ran its scripts |
| "The payment page is taking too long" | 25s after `alive`, no `suqo:ready` | the page ran but the block never mounted |

"Try again" remounts the WebView fresh; "Close" settles the session as `closed`, same as a
buyer backing out. Turn on `debug` and read `onEvent` / the forwarded console output before
assuming it is this package rather than the session itself (expired, wrong environment).

**`open()` rejects immediately.**
Either a checkout is already open (call `close()` or wait for the current one to settle before
opening another), or the `sessionId` / resolved `baseUrl` could not build a URL — check you are
not passing an empty string, and that `mode` or `baseUrl` points at the environment the session
was actually created against.

**The buyer paid but the app shows `cancelled`.**
Should not happen: the page only reports `cancelled` from the gateway's own return URL, never
from the WebView closing. If you see it, confirm the checkout page itself is up to date with
`js-checkout`'s protocol (`§5.14` — a closed gateway window is not treated as an outcome) rather
than assuming this SDK invented the status.

**Nothing comes back at all; the sheet just sits there.**
The checkout page is not recognising this as a native host — confirm it still checks for
`window.SuqoWebView` / `window.ReactNativeWebView`, treats a native host as a gateway window
(skips `return_url`), and hands off to gateways in the *same* window rather than a popup. See
[Requirements on the SUQO web app](../README.md#requirements-on-the-suqo-web-app) in the
README.

**A bank/wallet deeplink does nothing.**
Watch for `onEvent({ type: 'handoff_failed', scheme })` — it means the OS had no app
registered for that scheme (the bank app isn't installed, or the scheme is wrong for the
platform you're testing on).
