# @suqo/react-native — example

An Expo app that drives the SDK. It runs **with no backend and no SUQO frontend**.

## Run it

```bash
npm install
npm run mock       # in one terminal — prints a LAN address
npm start          # in another, then open in Expo Go
```

Paste the address the mock server printed as the **Base URL** on the home screen. On a
physical device use the LAN address it prints, not `localhost` — on a phone, `localhost` is
the phone.

## What the mock server is

`mock-server.mjs` serves pages that speak the same `postMessage` protocol as the real
checkout: `suqo:alive`, `suqo:ready`, `suqo:resize`, `suqo:gateway` and `suqo:result`. So the
SDK's real paths are what run — the injection, the message parsing, the navigation
interception, the sheet resize, the one-outcome latch. Nothing is stubbed inside the SDK.

It verifies nothing and takes no money. It is a fixture, not a SUQO implementation.

What you can exercise:

| On the mock checkout page                      | What it proves                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| Pay — succeeds                                 | gateway navigation in the same window → return page → `onSuccess`    |
| Pay — declined                                 | `onFailure` with `status: 'failed'`                                  |
| Pay — cancel at gateway                        | `onFailure` with `status: 'cancelled'`, which is **not** `failed`    |
| Grow the block                                 | `suqo:resize` grows the sheet instead of scrolling it                |
| Open a bank app                                | the deeplink is handed to the OS, and the WebView refuses to load it |
| Drag the handle down / backdrop / Android back | `onClose`, exactly once                                              |

The deeplink opens a real `fonepayApp://` URL. With no bank app installed the OS refuses it
and the example logs `handoff_failed` — which is the interesting case to see, because the
sheet must stay exactly as it was rather than settling the payment.

## Screens

| Screen           | Shows                                                                   |
| ---------------- | ----------------------------------------------------------------------- |
| `app/index.tsx`  | The callback form, plus which single callback fired and what it carried |
| `app/await.tsx`  | The same flow with `await open()`                                       |
| `app/events.tsx` | Everything `onEvent` reported                                           |

The home screen also has a button that pays with a blank email, to show that `open()` rejects
and names the field **before** the sheet appears.

## Against a real deployment

```bash
EXPO_PUBLIC_SUQO_BASE_URL=https://test.suqo.ai \
EXPO_PUBLIC_SUQO_SUBSCRIPTION_ID=<a real subscription uuid> \
npx expo start -c
```

Both are editable on the home screen too, so switching does not need a restart. A real
deployment needs the SUQO web-app changes listed in the package README under "Requirements on
the SUQO web app" — without them the page loads and renders but reports nothing back.

## Note on the local package link

`@suqo/react-native` is a `file:..` dependency, and `metro.config.js` pins `react`,
`react-native` and `react-native-webview` to this app's own copies. Without that pinning the
package resolves the parent's devDependency copies and the app ends up with two Reacts —
which fails with an invalid-hook-call error that gives no hint of the real cause.
