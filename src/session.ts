/**
 * One `open()` call's lifetime, and the latch that makes it report exactly once.
 *
 * Pure — no React, no React Native — so the race that matters here is testable directly.
 *
 * @packageDocumentation
 */

import { log } from './log'
import type { ReturnParams, SuqoCheckoutOptions, SuqoOutcome, SuqoEvent } from './types'

/** What settled a session, before it is shaped into the public outcome. */
export type Settlement =
  | { result: 'success'; params: ReturnParams; message?: string }
  | { result: 'failure'; status: 'failed' | 'cancelled'; params: ReturnParams; message?: string }
  | { result: 'closed' }

export interface CheckoutSession {
  /** Monotonic, per provider. Keys the WebView so a second `open()` gets a fresh one. */
  readonly key: number
  readonly sessionId: string
  readonly promise: Promise<SuqoOutcome>
  /**
   * Records the outcome. Returns true if this call is the one that settled the session, and
   * false if something already had.
   *
   * Separate from {@link deliver} because the two happen at different times: settling is
   * immediate, so a losing caller can be told to stand down, while the host's callback fires
   * once the sheet has finished animating away.
   */
  settle(settlement: Settlement): boolean
  /** Fires the host's callback and resolves the promise. Idempotent. */
  deliver(): void
  readonly settled: boolean
  readonly outcome: SuqoOutcome | null
}

let nextKey = 1

export function createSession(
  options: SuqoCheckoutOptions,
  onEvent?: (event: SuqoEvent) => void
): CheckoutSession {
  const { sessionId } = options
  let settlement: Settlement | null = null
  let delivered = false
  let resolve!: (outcome: SuqoOutcome) => void

  const promise = new Promise<SuqoOutcome>((r) => {
    resolve = r
  })

  const toOutcome = (s: Settlement): SuqoOutcome => {
    switch (s.result) {
      case 'success':
        return {
          result: 'success',
          sessionId,
          params: s.params,
          ...(s.message === undefined ? {} : { message: s.message }),
        }
      case 'failure':
        return {
          result: 'failure',
          sessionId,
          status: s.status,
          params: s.params,
          ...(s.message === undefined ? {} : { message: s.message }),
        }
      case 'closed':
        return { result: 'closed', sessionId }
    }
  }

  const session: CheckoutSession = {
    key: nextKey++,
    sessionId,

    promise,

    settle(next) {
      // Compare-and-set, synchronous. Two things genuinely race here: a `suqo:result`
      // arriving from the page, and the buyer dismissing the sheet. First one wins, so a
      // duplicate result — the protocol delivers one over several paths on purpose — is a
      // no-op rather than a second callback.
      if (settlement !== null) {
        // One exception to first-wins: a verified result beats an earlier dismissal, as long
        // as nothing has been delivered yet.
        //
        // The buyer drags the sheet away and, a frame later, `suqo:result` arrives — the
        // page had already verified the payment with the backend. Reporting `onClose` there
        // would tell the app nothing happened while the customer's money moved. A dismissal
        // is a statement of intent; a result is what the server confirmed, so the result is
        // what stands.
        const upgradable = !delivered && settlement.result === 'closed' && next.result !== 'closed'
        if (!upgradable) {
          log('settle.ignored', { had: settlement.result, got: next.result })
          return false
        }
        log('settle.upgraded', { had: settlement.result, got: next.result })
      }
      settlement = next
      return true
    },

    deliver() {
      if (delivered || settlement === null) return
      delivered = true

      const outcome = toOutcome(settlement)
      onEvent?.({ type: 'settled', sessionId, outcome: outcome.result })
      log('deliver', { outcome: outcome.result })

      // Resolved first, so an `await open()` caller and a callback caller observe the same
      // ordering regardless of which style they chose.
      resolve(outcome)

      switch (outcome.result) {
        case 'success':
          options.onSuccess?.(outcome)
          break
        case 'failure':
          options.onFailure?.(outcome)
          break
        case 'closed':
          options.onClose?.()
          break
      }
    },

    get settled() {
      return settlement !== null
    },

    get outcome() {
      return settlement === null ? null : toOutcome(settlement)
    },
  }

  return session
}

/** Maps a `suqo:result` status onto a settlement. */
export function settlementFromResult(
  status: 'success' | 'failed' | 'cancelled',
  params: ReturnParams,
  message?: string
): Settlement {
  if (status === 'success') {
    return { result: 'success', params, ...(message === undefined ? {} : { message }) }
  }
  return {
    result: 'failure',
    status,
    params,
    ...(message === undefined ? {} : { message }),
  }
}
