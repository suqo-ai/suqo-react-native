import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

import { SuqoProvider } from '@suqo/react-native'
import type { CheckoutMode } from '@suqo/react-native'

import { DEFAULT_BASE_URL } from '../src/config'
import { EventLogProvider, useEventLog } from '../src/EventLog'
import { BaseUrlContext } from '../src/base-url'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <EventLogProvider>
        <Providers />
      </EventLogProvider>
    </SafeAreaProvider>
  )
}

/**
 * Mode and base-url override live above `SuqoProvider` so the home screen can change either
 * without a restart — handy when switching between the mock server, sandbox, and live.
 */
function Providers() {
  const [mode, setMode] = useState<CheckoutMode>('sandbox')
  // Starts non-empty, pointed at the mock server, so the example works with no backend and
  // no screen visited first. Clearing it hands control to `mode`, same as the SDK's own
  // `baseUrl` / `mode` precedence.
  const [override, setOverride] = useState(DEFAULT_BASE_URL)
  const { record } = useEventLog()
  const insets = useSafeAreaInsets()

  return (
    <BaseUrlContext.Provider value={{ mode, setMode, override, setOverride }}>
      <SuqoProvider
        mode={mode}
        {...(override.trim() === '' ? {} : { baseUrl: override })}
        // This app has safe-area-context, so it passes real values rather than letting the
        // SDK fall back to its platform heuristic.
        insets={{ top: insets.top, bottom: insets.bottom }}
        debug
        onEvent={record}
      >
        <Stack
          screenOptions={{
            headerTitleStyle: { fontSize: 16, color: '#D9DDE1' },
            headerStyle: { backgroundColor: '#14171B' },
            headerTintColor: '#35D08F',
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="index" options={{ title: 'SUQO SDK example' }} />
          <Stack.Screen name="await" options={{ title: 'await open()' }} />
          <Stack.Screen name="events" options={{ title: 'Event log' }} />
        </Stack>
      </SuqoProvider>
    </BaseUrlContext.Provider>
  )
}
