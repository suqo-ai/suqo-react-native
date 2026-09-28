# @suqo/react-native

Collect a SUQO payment on a full-screen checkout screen. No gateway integration, no payment
UI to build.

```
npm install @suqo/react-native react-native-webview
```

`react-native-webview` is the only native dependency, so this works in Expo Go and in bare
React Native with no extra configuration — no Reanimated, no Gesture Handler, no config
plugin.

## What it does, and what it does not

Your backend already creates the checkout session through SUQO's API and holds its id. This
package takes that id, opens SUQO's own checkout page for it in a sheet, and tells you how the
payment went.

It makes **no SUQO API calls of its own and holds no credential**. The gateway list, the
payment call, the hand-off to eSewa / Khalti / ConnectIPS / NPS and the verification all belong
to the page inside the WebView. The session id is the only thing this package knows — and it is
single-use, short-lived, and carries no buyer details of its own, so nothing sensitive and
nothing long-lived ever sits in your app bundle.

## Usage

Mount the provider once, at your app root:

```tsx
import { SuqoProvider } from '@suqo/react-native'

export default function App() {
  return (
    <SuqoProvider baseUrl="https://test.suqo.ai">
      <Navigation />
    </SuqoProvider>
  )
}
```

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
outcome, if you prefer `await`:

```tsx
const outcome = await open({ sessionId })
if (outcome.result === 'success') {
  /* … */
}
```

### There is nothing about the buyer here

A checkout session is created on your own backend with your API key, and it already carries
the buyer. Their name, email and address never pass through this SDK, never reach the device,
and never end up in a log — which also means there is nothing for you to validate before
opening the sheet.

`open()` rejects **before the sheet appears** for exactly two reasons: a checkout is already
open, or the session id and base URL cannot produce a checkout URL.

### `cancelled` is not `failed`

`onFailure` receives `status: 'cancelled'` when the buyer backed out at the gateway, and
`'failed'` when a payment was attempted and rejected. Check it: a buyer who changed their
mind wants the basket offered again, while a rejected payment is worth looking into. Nothing
is charged in either case.

### `params` is the gateway's, verbatim

Every gateway names its transaction differently — eSewa a signed `data` blob, Khalti a
`pidx`, ConnectIPS a `TXNID`, NPS a `MerchantTxnId`. `params` is passed through with no
renaming or filtering, because you reconcile against whatever your own backend recorded, and
normalising would throw away the only field you can match on.

`message` is what SUQO's backend said when it settled the payment. It is a separate argument
so our keys never mix into `params`, and it is `undefined` when the backend said nothing —
so it is never copy this SDK invented. On a failure it is usually the only place the reason
exists.

## The outcome is a signal to navigate, not proof of fulfilment

`onSuccess` fires only after the checkout page verified the payment with SUQO's backend, so
it is a real signal rather than a redirect's claim. Even so, **the webhook is authoritative**.
Treat `onSuccess` as "move the buyer on", and let your own backend decide that an order is
paid from its own record. That is true of every payment integration and it is worth stating
plainly here.

## Options

| Prop           | Default          | Notes                                                         |
| -------------- | ---------------- | ------------------------------------------------------------- |
| `baseUrl`      | —                | Required. Where SUQO's checkout is served from.               |
| `checkoutPath` | `/c/:id`         | The route, with `:id` for the checkout session id.            |
| `title`        | `Secure payment` | Sheet header. The amount and seller are rendered by the page. |
| `insets`       | measured         | See below.                                                    |
| `debug`        | `false`          | Turns on this package's redacted console logging.             |
| `onEvent`      | —                | A debug stream for your own logs. Not a payment signal.       |

### Safe-area insets — pass them if you can

Without `insets` the screen measures the safe area with a **platform heuristic**: status-bar
height and a nav-bar estimate on Android, a home-indicator guess on iOS. It is a reasonable
default, not a solved problem, and taking `react-native-safe-area-context` as a peer
dependency would have cost every consumer an install and two providers.

If your app already has it, pass real values:

```tsx
const insets = useSafeAreaInsets()

<SuqoProvider baseUrl={…} insets={{ top: insets.top, bottom: insets.bottom }}>
```

## What the buyer sees

A full-height screen slides in with the SUQO payment block inside it: a back button, a title,
and the block filling the rest. The block scrolls — a seller with NPS enabled lists every
supported bank, which runs well past a phone screen.

It is presented as a full-screen `Modal`, not a route in your navigator, so there is nothing
to register and no route name to agree on — and it still behaves like a pushed screen,
including Android's hardware back button. Back, hardware back, or `close()` all dismiss it
and report `onClose`.

When the buyer's bank needs its own app, the screen hands the deeplink to the OS and the bank
app opens over yours. Coming back leaves the screen exactly as it was, mid-payment.

## Requirements on the SUQO web app

This package is one half of a protocol; `js-checkout/PROTOCOL.md` is the contract. The page at
`/c/<sessionId>` must:

- recognise a native host and route its messages through the injected bridge — it checks for
  `window.SuqoWebView`, then `window.ReactNativeWebView`, which `react-native-webview`
  provides, so nothing is required from this side,
- deliver `suqo:result` over that channel after verifying with the backend,
- treat a native host as a gateway window, so it does not follow the seller's `return_url`
  inside the screen,
- allow the document to scroll when hosted natively (`data-suqo-embed="native"`), since the
  screen cannot grow past the display,
- hand off to gateways in the **same** window rather than opening a popup,
- post `suqo:alive` from the route's layout and `suqo:ready` from the block. Sending both from
  the same place collapses the two load deadlines into one and the alive deadline stops
  meaning anything.

All of these are satisfied by the app today. A page without them loads and renders but reports
nothing back — the screen sits there until the buyer dismisses it.

## Logging

`debug` prints redacted lines only: session ids, URLs and gateway params are scrubbed by shape
as well as by key name, because an id interpolated into a message never arrives under a name a
deny-list could catch. Redaction runs before the enabled check, so debug output cannot
leak anything default output would not.

## Development

```bash
npm install
npm run typecheck    # src against real RN types, tests against the stubs
npm test
npm run lint
npm run build

cd example && npm install && npx expo start
```

The example runs with **no backend at all** — see `example/README.md`.

## License

Apache-2.0
