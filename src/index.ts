/**
 * `@suqo/react-native` — collect a SUQO payment in a bottom sheet.
 *
 * The host app's own backend creates the subscription and holds its id. This package opens
 * the SUQO checkout page for that id in a sheet, lets the buyer pay, and reports the outcome
 * the page verified. It makes no SUQO API calls of its own and holds no credential.
 *
 * @packageDocumentation
 */

export { SuqoProvider } from './SuqoProvider'
export type { SuqoProviderProps, SuqoCheckoutHandle } from './SuqoProvider'
export { useSuqoCheckout } from './useSuqoCheckout'
export { SuqoConfigError } from './errors'
export { DEFAULT_CHECKOUT_PATH } from './urls'
export type {
  ReturnParams,
  SuqoCheckoutOptions,
  SuqoEvent,
  SuqoFailure,
  SuqoInsets,
  SuqoOutcome,
  SuqoSuccess,
} from './types'

/** This package's version, as published. */
export const VERSION = '0.2.0'
