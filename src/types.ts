/**
 * The public type surface. Everything a host app touches is declared here.
 *
 * @packageDocumentation
 */

/**
 * A gateway's return parameters, exactly as the gateway sent them.
 *
 * Deliberately not normalised. Every Nepali gateway names its transaction id differently —
 * eSewa a signed `data` blob, Khalti a `pidx`, ConnectIPS a `TXNID`, NPS a `MerchantTxnId` —
 * and the host app reconciles against whatever its own backend recorded. Renaming or
 * filtering here would throw away the only field it can match on.
 */
export type ReturnParams = Record<string, string>

/** A payment that settled successfully, after the checkout page verified it with the backend. */
export interface SuqoSuccess {
  sessionId: string
  params: ReturnParams
  /** What SUQO's backend said when it settled the payment. Absent when it said nothing. */
  message?: string
}

/**
 * A payment that did not settle.
 *
 * `cancelled` and `failed` need opposite handling downstream and must not be collapsed: a
 * buyer who backed out wants the basket offered again, while a rejected payment is worth
 * investigating. Nothing is charged in either case.
 */
export interface SuqoFailure {
  sessionId: string
  status: 'failed' | 'cancelled'
  params: ReturnParams
  message?: string
}

/** The resolved value of `open()`, for callers who prefer `await` to callbacks. */
export type SuqoOutcome =
  | ({ result: 'success' } & SuqoSuccess)
  | ({ result: 'failure' } & SuqoFailure)
  /** The sheet was dismissed before anything settled. Nothing was charged. */
  | { result: 'closed'; sessionId: string }

/**
 * What `open()` is called with. Exactly one of the three callbacks fires.
 *
 * There is nothing about the buyer here. The checkout session is created on the merchant's own
 * backend and already carries them, so their name, email and address never pass through this
 * SDK, never reach the device, and never end up in a log.
 */
export interface SuqoCheckoutOptions {
  /** The checkout session to pay, e.g. `cks_9f2c41a8`. */
  sessionId: string
  onSuccess?: (result: SuqoSuccess) => void
  onFailure?: (result: SuqoFailure) => void
  onClose?: () => void
}

/**
 * A debug stream for the host app's own logging. Not a payment signal — the callbacks are.
 *
 * Ids are redacted on the way into this SDK's own log output, but events handed to the host
 * carry the real `sessionId`: it is the host's own identifier, and it is what makes an event
 * useful in their logs. Redaction is about what *this* package prints.
 */
export type SuqoEvent =
  | { type: 'open'; sessionId: string }
  | { type: 'alive'; sessionId: string }
  | { type: 'ready'; sessionId: string }
  | { type: 'resize'; sessionId: string; height: number }
  | { type: 'gateway'; sessionId: string }
  | { type: 'handoff'; sessionId: string; scheme: string }
  | { type: 'handoff_failed'; sessionId: string; scheme: string }
  | { type: 'load_timeout'; sessionId: string; stage: 'alive' | 'ready' }
  | { type: 'load_error'; sessionId: string }
  /**
   * The session cannot be paid at all — expired, already spent, created without a customer.
   *
   * Deliberately an event and not a callback. No payment was attempted, so `onFailure` would
   * be a lie; the buyer sees the frame's own explanation and dismisses, which settles as
   * `closed`. This is here so the merchant can find out *why* in their own logs.
   */
  | {
      type: 'unavailable'
      sessionId: string
      reason: 'not-found' | 'expired' | 'spent' | 'no-customer' | 'no-methods' | 'load-failed'
    }
  | { type: 'settled'; sessionId: string; outcome: SuqoOutcome['result'] }

/** Vertical insets the sheet must stay clear of. */
export interface SuqoInsets {
  top: number
  bottom: number
}
