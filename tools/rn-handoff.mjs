/**
 * Proves the fourth frontend edit: under a React Native host, the gateway hand-off must
 * navigate THIS window and open no popup.
 *
 * The browser embed opens a named blank window in the click handler and form-POSTs into it
 * by name. A WebView has one window and hands back no usable handle, so that path would
 * leave the buyer on a blank screen with a payment already created.
 */
import { chromium } from 'playwright'

const APP = process.env.APP_URL ?? 'http://localhost:3001'
const API = 'https://dev-be.suqo.ai'
const SESSION_ID = '4d7edf60-caef-427d-bcdc-b621e6c1ef85'
const PRODUCT_ID = 'prod-1'
const CYCLE_PUBLIC_ID = 'cycle-public-1'
const GATEWAY_HOST = 'https://uat.esewa.com.np'

const product = {
  id: PRODUCT_ID,
  name: 'Streaming Plus',
  user: { user_id: 'company-1' },
  is_vat_active: false,
  vat_percentage: 0,
  vat_type: 'exclusive',
  plan: [
    {
      id: '257',
      name: 'Standard',
      billing_cycles: [
        {
          id: 1,
          public_id: CYCLE_PUBLIC_ID,
          cycle: 'monthly',
          interval: 'monthly',
          price: '1000',
          is_archived: false,
          is_current: true,
        },
      ],
    },
  ],
}

const rnHost = process.env.RN_HOST !== '0'

const browser = await chromium.launch()
const context = await browser.newContext()

/**
 * Bridge messages are collected out here in Node, not in a page array.
 *
 * The real bridge hands each message straight out of the page, and that is the property
 * that matters for this test: the buyer's window navigates to the gateway, so anything
 * stored in the document is gone by the time the assertions run.
 */
const bridge = []
if (rnHost) {
  await context.exposeBinding('__suqoBridge', (_source, raw) => {
    bridge.push(JSON.parse(String(raw)))
  })
  await context.addInitScript(() => {
    window.ReactNativeWebView = {
      postMessage: (raw) => {
        window.__suqoBridge(raw)
      },
    }
  })
}

// Counts popups. Under an RN host there must be none.
//
// `context.on('page')` also fires for the page this script opens itself, so the main page is
// excluded explicitly — counting it made a passing run look like a failure.
// `context.on('page')` fires for the page this script opens itself, and it fires *before*
// `newPage()` resolves — so the main page cannot be excluded as it arrives. Everything is
// collected here and filtered by identity at assert time.
const openedPages = []
context.on('page', (opened) => openedPages.push(opened))

let createBody = null

await context.route(`${API}/**`, async (route) => {
  const path = new URL(route.request().url()).pathname
  const json = (body) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

  if (path.includes('/subscription-payment-phone/renew/')) {
    return json({
      tokens: { access: 'guest-token' },
      product_id: PRODUCT_ID,
      plan_id: '257',
      plan_billing_period_id: CYCLE_PUBLIC_ID,
    })
  }
  if (path.includes('/subscriptions/products/')) return json(product)
  if (path.includes('/available-payment-methods/')) {
    return json([{ payment_type_id: 1, payment_type: 'esewa', name: 'eSewa', is_active: true }])
  }
  if (path === '/api/subscriber/subscription/') {
    createBody = route.request().postDataJSON()
    // eSewa is a form-post gateway: the backend hands back a form to submit, not a URL.
    return json({
      form_url: `${GATEWAY_HOST}/epay/main`,
      fields: { amount: '1000', product_code: 'EPAYTEST', signature: 'sig' },
    })
  }
  return json({})
})

// Stands in for the gateway, so a navigation there is observable.
const navigations = []
await context.route(`${GATEWAY_HOST}/**`, async (route) => {
  const request = route.request()
  navigations.push({ url: request.url(), method: request.method() })
  return route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<html><body><h1>Mock eSewa</h1></body></html>',
  })
})

const page = await context.newPage()
await page.goto(`${APP}/c/${SESSION_ID}`, { waitUntil: 'load' })
// The page boots from its own fetch; there is nothing to hand it and nothing to wait for
// beyond the block rendering.
await page.waitForTimeout(1200)

await page.getByText('eSewa', { exact: false }).first().click()
await page.locator('#external-payment-terms').click()
await page.getByRole('button', { name: /Pay/i }).click()
await page.waitForTimeout(2500)

console.log(`\n--- ${rnHost ? 'React Native host' : 'browser (control)'} ---`)
console.log('  create-payment sent :', createBody ? 'yes' : 'NO')
if (createBody) {
  console.log('    payment_method    :', createBody.payment_method)
  console.log('    full_name         :', createBody.full_name)
}
const popups = openedPages.filter((opened) => opened !== page)
console.log('  popups opened       :', popups.length, popups.map((p) => p.url()).join(' | '))
console.log('  gateway navigations :', navigations.length, navigations.map((n) => n.method).join(','))
console.log('  this window is now  :', page.url())
if (rnHost) console.log('  bridge posts        :', bridge.map((m) => m.type).join(', '))

const checks = rnHost
  ? {
      'the payment was created': Boolean(createBody),
      'no popup was opened': popups.length === 0,
      'the sheet was told about the gateway': bridge.some((m) => m.type === 'suqo:gateway'),
      'the gateway was POSTed to': navigations.some((n) => n.method === 'POST'),
      'this window navigated to the gateway': page.url().startsWith(GATEWAY_HOST),
    }
  : {
      'the payment was created': Boolean(createBody),
      'a popup was opened for the gateway': popups.length === 1,
      'this window stayed on the checkout': page.url().startsWith(APP),
    }

console.log('\n--- verdict ---')
let ok = true
for (const [name, passed] of Object.entries(checks)) {
  console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${name}`)
  if (!passed) ok = false
}

await browser.close()
process.exit(ok ? 0 : 1)
