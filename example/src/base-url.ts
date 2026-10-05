import { createContext, useContext } from 'react'

import type { CheckoutMode } from '@suqo/react-native'

import { DEFAULT_BASE_URL } from './config'

export const BaseUrlContext = createContext<{
  mode: CheckoutMode
  setMode(mode: CheckoutMode): void
  /** Empty means "let `mode` decide" — mirrors how `baseUrl` overrides `mode` in the SDK. */
  override: string
  setOverride(url: string): void
}>({
  mode: 'sandbox',
  setMode: () => {},
  override: DEFAULT_BASE_URL,
  setOverride: () => {},
})

export const useBaseUrl = () => useContext(BaseUrlContext)
