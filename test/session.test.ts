import { describe, expect, it, vi } from 'vitest'

import { createSession, settlementFromResult } from '../src/session'
import type { SuqoCheckoutOptions } from '../src/types'

const options = (overrides: Partial<SuqoCheckoutOptions> = {}): SuqoCheckoutOptions => ({
  sessionId: 'cks_1',
  ...overrides,
})

describe('createSession', () => {
  it('gives each session a distinct key so a second open remounts the WebView', () => {
    const first = createSession(options())
    const second = createSession(options())
    expect(second.key).not.toBe(first.key)
  })
})

describe('one outcome per session', () => {
  it('delivers success to onSuccess and resolves the promise', async () => {
    const onSuccess = vi.fn()
    const onFailure = vi.fn()
    const onClose = vi.fn()
    const session = createSession(options({ onSuccess, onFailure, onClose }))

    session.settle(settlementFromResult('success', { pidx: 'bZQL' }, 'Payment verified'))
    session.deliver()

    await expect(session.promise).resolves.toEqual({
      result: 'success',
      sessionId: 'cks_1',
      params: { pidx: 'bZQL' },
      message: 'Payment verified',
    })
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onFailure).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('keeps cancelled and failed apart', async () => {
    const onFailure = vi.fn()
    const session = createSession(options({ onFailure }))
    session.settle(settlementFromResult('cancelled', {}))
    session.deliver()
    await session.promise
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', sessionId: 'cks_1' })
    )
  })

  it('omits message when the backend sent none', async () => {
    const session = createSession(options())
    session.settle(settlementFromResult('failed', {}))
    session.deliver()
    const outcome = await session.promise
    expect('message' in outcome).toBe(false)
  })

  it('ignores a duplicate result — the protocol delivers one over several paths', () => {
    const onSuccess = vi.fn()
    const session = createSession(options({ onSuccess }))

    expect(session.settle(settlementFromResult('success', { pidx: 'a' }))).toBe(true)
    expect(session.settle(settlementFromResult('success', { pidx: 'a' }))).toBe(false)
    session.deliver()
    session.deliver()

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('reports a dismissal as closed and nothing else', async () => {
    const onSuccess = vi.fn()
    const onFailure = vi.fn()
    const onClose = vi.fn()
    const session = createSession(options({ onSuccess, onFailure, onClose }))

    session.settle({ result: 'closed' })
    session.deliver()

    await expect(session.promise).resolves.toEqual({ result: 'closed', sessionId: 'cks_1' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('lets a verified result arriving after a dismissal win, while nothing is delivered yet', async () => {
    const onSuccess = vi.fn()
    const onClose = vi.fn()
    const session = createSession(options({ onSuccess, onClose }))

    // The buyer swipes the sheet away; a frame later the page reports a payment it had
    // already verified with the backend. Reporting a close there would tell the app nothing
    // happened while the customer's money moved.
    session.settle({ result: 'closed' })
    expect(session.settle(settlementFromResult('success', { pidx: 'bZQL' }))).toBe(true)
    session.deliver()

    await expect(session.promise).resolves.toMatchObject({ result: 'success' })
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not let a dismissal override a result', () => {
    const session = createSession(options())
    session.settle(settlementFromResult('failed', {}))
    expect(session.settle({ result: 'closed' })).toBe(false)
    expect(session.outcome).toMatchObject({ result: 'failure', status: 'failed' })
  })

  it('does not upgrade once the outcome has been delivered', () => {
    const onClose = vi.fn()
    const onSuccess = vi.fn()
    const session = createSession(options({ onClose, onSuccess }))

    session.settle({ result: 'closed' })
    session.deliver()
    expect(session.settle(settlementFromResult('success', {}))).toBe(false)

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('does nothing when deliver runs before anything settled', () => {
    const onClose = vi.fn()
    const session = createSession(options({ onClose }))
    session.deliver()
    expect(onClose).not.toHaveBeenCalled()
    expect(session.settled).toBe(false)
  })

  it('reports the settled outcome through onEvent exactly once', () => {
    const onEvent = vi.fn()
    const session = createSession(options(), onEvent)
    session.settle(settlementFromResult('success', {}))
    session.deliver()
    session.deliver()
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith({
      type: 'settled',
      sessionId: 'cks_1',
      outcome: 'success',
    })
  })
})
