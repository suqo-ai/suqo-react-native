import { createContext, useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { SuqoConfigError } from './errors'
import { setDebug } from './log'
import type { CheckoutSession } from './session'
import { createSession } from './session'
import type { SuqoCheckoutOptions, SuqoEvent, SuqoInsets, SuqoOutcome } from './types'
import { buildCheckoutUrl, DEFAULT_CHECKOUT_PATH, resolveBaseUrl } from './urls'
import type { CheckoutMode } from './urls'
import { CheckoutScreen } from './ui/CheckoutScreen'

export interface SuqoProviderProps {
  /** `'live'` → `app.suqo.ai`, `'sandbox'` → `test.suqo.ai`. Defaults to `'sandbox'`. */
  mode?: CheckoutMode
  /** Where the SUQO checkout is served from, e.g. `https://test.suqo.ai`. Overrides `mode`. */
  baseUrl?: string
  /**
   * The checkout route, with `:id` standing in for the subscription id.
   *
   * Configurable because the route belongs to the SUQO web app, which this package does not
   * ship. The default is the route that exists today.
   */
  checkoutPath?: string
  /** Screen header title. The amount and the seller are rendered by the page, not here. */
  title?: string
  /**
   * The line under the spinner while the page loads.
   *
   * Separate from `title` because it is the one piece of copy a buyer reads before anything
   * of the seller's is on screen, and an app with its own voice — or its own language — has
   * nothing else to change it with.
   */
  loadingLabel?: string
  /**
   * Exact safe-area insets.
   *
   * Recommended for any app that already has `react-native-safe-area-context`. Without it
   * the screen falls back to a platform heuristic — a reasonable default, not a substitute
   * for real measurements.
   */
  insets?: SuqoInsets
  /** Turns on this package's redacted console logging. */
  debug?: boolean
  /** A debug stream for the host's own logging. Not a payment signal — the callbacks are. */
  onEvent?: (event: SuqoEvent) => void
  children: ReactNode
}

/** What {@link useSuqoCheckout} returns. */
export interface SuqoCheckoutHandle {
  /**
   * Opens the payment sheet. Resolves with the outcome, and calls exactly one of the three
   * callbacks. Rejects when a checkout is already open, or when the session id or base URL
   * cannot produce a checkout URL — both before anything is shown.
   */
  open(options: SuqoCheckoutOptions): Promise<SuqoOutcome>
  /** Closes the sheet as though the buyer dismissed it. */
  close(): void
}

export const SuqoContext = createContext<SuqoCheckoutHandle | null>(null)

/** The session and the URL it resolved to, kept together so one render sees both. */
interface ActiveCheckout {
  session: CheckoutSession
  url: string
}

/**
 * Mounted once, at the app root. Owns the payment screen, so there is exactly one of it
 * however many callers use `open()`.
 *
 * It holds no credential. The subscription id passed to `open()` is the only thing
 * identifying the payment, and the page inside the WebView is what exchanges it for a
 * scoped, short-lived payment token — so nothing long-lived reaches the app bundle.
 */
export function SuqoProvider({
  mode,
  baseUrl,
  checkoutPath = DEFAULT_CHECKOUT_PATH,
  title = 'Secure payment',
  loadingLabel = 'Loading secure checkout',
  insets,
  debug = false,
  onEvent,
  children,
}: SuqoProviderProps) {
  // Applied during render rather than in an effect so a log from the first `open()` in a
  // child's own effect is not missed. Idempotent: it sets one module-level boolean.
  setDebug(debug)

  const [active, setActive] = useState<ActiveCheckout | null>(null)
  /**
   * Bumped by `close()`, watched by the sheet.
   *
   * A signal rather than an imperative handle: routing programmatic close through the same
   * path as the back button is what keeps "exactly one outcome, after the exit animation"
   * true for both.
   */
  const [closeSignal, setCloseSignal] = useState(0)
  // Read by `open()` so a second call is rejected without waiting for a state flush.
  const openRef = useRef(false)

  const open = useCallback(
    (options: SuqoCheckoutOptions): Promise<SuqoOutcome> => {
      if (openRef.current) {
        // Two payments at once has no coherent meaning: there is one screen, and the second
        // would either steal the first's WebView or sit invisibly behind it.
        return Promise.reject(
          new SuqoConfigError('a checkout is already open — close it before opening another')
        )
      }

      // Validated synchronously, before anything is shown. Surfaced as a rejection so the
      // caller has one failure channel instead of two.
      let next: ActiveCheckout
      try {
        next = {
          session: createSession(options, onEvent),
          url: buildCheckoutUrl(resolveBaseUrl(baseUrl, mode), options.sessionId, checkoutPath),
        }
      } catch (error) {
        return Promise.reject(error)
      }

      openRef.current = true
      setActive(next)
      return next.session.promise
    },
    [baseUrl, mode, checkoutPath, onEvent]
  )

  const close = useCallback(() => {
    if (!openRef.current) return
    setCloseSignal((value) => value + 1)
  }, [])

  const value = useMemo<SuqoCheckoutHandle>(() => ({ open, close }), [open, close])

  const onDismissed = useCallback(() => {
    openRef.current = false
    setActive(null)
  }, [])

  return (
    <SuqoContext.Provider value={value}>
      {children}
      <CheckoutScreen
        session={active?.session ?? null}
        url={active?.url ?? ''}
        title={title}
        loadingLabel={loadingLabel}
        debug={debug}
        closeSignal={closeSignal}
        {...(insets ? { insets } : {})}
        {...(onEvent ? { onEvent } : {})}
        onDismissed={onDismissed}
      />
    </SuqoContext.Provider>
  )
}
