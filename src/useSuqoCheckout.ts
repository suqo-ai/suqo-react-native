import { useContext } from 'react'

import { SuqoConfigError } from './errors'
import { SuqoContext } from './SuqoProvider'

/**
 * Opens the payment sheet.
 *
 * ```tsx
 * const { open } = useSuqoCheckout()
 *
 * open({
 *   sessionId,
 *   onSuccess: ({ params }) => router.replace('/thanks'),
 *   onFailure: ({ status }) => setError(status),
 *   onClose: () => {},
 * })
 * ```
 *
 * `open()` also resolves with the outcome, so `await` works instead of callbacks. Exactly
 * one of the three callbacks fires per call.
 */
export function useSuqoCheckout() {
  const context = useContext(SuqoContext)
  if (!context) {
    throw new SuqoConfigError(
      'useSuqoCheckout must be used inside <SuqoProvider>. Mount it once at your app root.'
    )
  }
  return context
}
