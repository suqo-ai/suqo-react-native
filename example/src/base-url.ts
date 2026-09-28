import { createContext, useContext } from 'react'

import { DEFAULT_BASE_URL } from './config'

export const BaseUrlContext = createContext<{
  baseUrl: string
  setBaseUrl(url: string): void
}>({ baseUrl: DEFAULT_BASE_URL, setBaseUrl: () => {} })

export const useBaseUrl = () => useContext(BaseUrlContext)
