# Cross-repo verification harnesses

Two Playwright scripts that drive the **real** SUQO checkout page in Chromium with the
`window.ReactNativeWebView` bridge injected, standing in for the WebView. They exist because
this package and the checkout page ship from different repos, so a change to one that is not
mirrored in the other fails silently — a checkout that loads, renders, takes a payment and
reports nothing.

They are not part of `npm test`: they need the SUQO frontend running and Playwright installed
ad hoc.

```bash
# in the SUQO frontend repo
npm run dev

# here (Playwright is not a dependency of this package)
npm install --no-save playwright && npx playwright install chromium-headless-shell
APP_URL=http://localhost:3000 node tools/rn-handoff.mjs
RN_HOST=0 APP_URL=http://localhost:3000 node tools/rn-handoff.mjs   # browser control
```

`rn-host.mjs` is gone. It proved the `suqo:init` handshake booted the block, and there is no
handshake any more — the page renders from its own fetch and recognises a native host by the
bridge `react-native-webview` injects, with no cooperation from this side.

`rn-handoff.mjs` asserts that Pay creates the payment, posts `suqo:gateway`, opens **no**
popup and navigates this window to the gateway. With `RN_HOST=0` it asserts the opposite —
a popup opens and the main window stays on the checkout — which is the guard on the
merchant-page embed being unaffected.

The API responses are mocked, so no backend is needed and no payment is created anywhere.
