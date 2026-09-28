/**
 * A stand-in for the SUQO checkout, speaking the same `postMessage` protocol.
 *
 * The point is to exercise the SDK's real paths with no backend and no frontend running:
 * a page that reports `suqo:alive`, `suqo:ready` and `suqo:resize`, a fake gateway that the
 * page navigates to in this same window, a return page that reports `suqo:result` the way
 * the real one does after verifying, and a bank deeplink to prove the hand-off to the OS.
 *
 *   npm run mock
 *
 * It prints a LAN address, because `localhost` on a phone is the phone.
 *
 * This is a demo fixture, not a SUQO implementation: it verifies nothing and takes no money.
 */
import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'

const PORT = Number(process.env.PORT ?? 8787)

const page = (body, script = '') => `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; margin: 0; padding: 20px;
         color: #0D062D; background: transparent }
  h1 { font-size: 17px; margin: 0 0 4px }
  p  { color: #667080; margin: 0 0 16px }
  a.btn, button.btn { display: block; width: 100%; box-sizing: border-box; text-align: center;
    margin: 10px 0; padding: 14px; border-radius: 10px; background: #635BFF; color: #fff;
    text-decoration: none; font-weight: 600; border: 0; font-size: 15px }
  button.alt { background: #EFEFFF; color: #635BFF }
  #extra { display: none; padding: 14px; margin-top: 10px; border: 1px solid #EAEAEA;
           border-radius: 10px; background: #F5F6FA }
</style></head>
<body><div id="card">${body}</div>
<script>
  var post = function (message) {
    var envelope = Object.assign({ source: 'suqo-checkout' }, message)
    // What the real page's postToHost does once it knows about a React Native host.
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(envelope))
  }
  var reportHeight = function () {
    var card = document.getElementById('card')
    if (card) post({ type: 'suqo:resize', height: Math.ceil(card.getBoundingClientRect().height) + 40 })
  }
  ${script}
</script></body></html>`

const CHECKOUT = page(
  `<h1>Mock checkout</h1>
   <p>Pretending to be the SUQO payment block. Nothing here takes money.</p>
   <button class="btn" onclick="location.href='/gateway?outcome=success'">Pay — succeeds</button>
   <button class="btn alt" onclick="location.href='/gateway?outcome=failed'">Pay — declined</button>
   <button class="btn alt" onclick="location.href='/gateway?outcome=cancelled'">Pay — cancel at gateway</button>
   <button class="btn alt" onclick="document.getElementById('extra').style.display='block';reportHeight()">
     Grow the block (like the NPS bank picker)
   </button>
   <div id="extra">The sheet should have grown to fit this, not scrolled it.</div>
   <a class="btn alt" href="fonepayApp://payment/?emandate=abc%3D%3D">Open a bank app (deeplink)</a>`,
  `
  // The real page posts alive from its layout, before the block has mounted.
  post({ type: 'suqo:alive' })
  window.addEventListener('load', function () {
    post({ type: 'suqo:ready' })
    reportHeight()
  })
  `
)

/** The fake gateway. Navigates this same window, which is what the RN path requires. */
const gateway = (outcome) =>
  page(
    `<h1>Mock gateway</h1><p>This is where a real gateway would be.</p>`,
    `
    post({ type: 'suqo:gateway' })
    setTimeout(function () {
      location.href = ${JSON.stringify(returnUrlFor(outcome))}
    }, 900)
    `
  )

function returnUrlFor(outcome) {
  if (outcome === 'success') return '/payment-success?pidx=bZQLmock&purchase_order_id=4417'
  if (outcome === 'cancelled') return '/payment-failure?status=cancelled'
  return '/payment-failure?status=failed&MerchantTxnId=mock-txn'
}

/**
 * The return page. In the real app this is where the verification call happens, and the
 * result is published only once the backend has confirmed it — which is why the SDK lets
 * this page load rather than reading the outcome off the URL.
 */
const returnPage = (status, params, message) =>
  page(
    `<h1>Verifying…</h1><p>The real page posts its result after the backend confirms it.</p>`,
    `
    setTimeout(function () {
      post({
        type: 'suqo:result',
        status: ${JSON.stringify(status)},
        params: ${JSON.stringify(params)},
        message: ${JSON.stringify(message)}
      })
    }, 700)
    `
  )

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
  const params = Object.fromEntries(url.searchParams.entries())
  const send = (html) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(html)
  }

  if (url.pathname.startsWith('/c/')) {
    return send(CHECKOUT)
  }
  if (url.pathname === '/gateway') {
    return send(gateway(params.outcome ?? 'success'))
  }
  if (url.pathname === '/payment-success') {
    return send(returnPage('success', params, 'Payment verified (mock)'))
  }
  if (url.pathname === '/payment-failure') {
    const cancelled = String(params.status ?? '').toLowerCase() === 'cancelled'
    return send(
      returnPage(
        cancelled ? 'cancelled' : 'failed',
        params,
        cancelled ? 'Cancelled at the gateway (mock)' : 'The gateway declined this payment (mock)'
      )
    )
  }

  response.writeHead(404, { 'content-type': 'text/plain' })
  response.end('not a mock route')
})

const lanAddress = () => {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address
    }
  }
  return 'localhost'
}

server.listen(PORT, () => {
  const host = lanAddress()
  process.stdout.write(
    `\nMock SUQO checkout on:\n\n  http://${host}:${PORT}\n\n` +
      `Paste that as the base URL in the example app. On a physical device use this LAN\n` +
      `address, not localhost — localhost on a phone is the phone.\n\n`
  )
})
