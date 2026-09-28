import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

import { SuqoProvider } from '@suqo/react-native'

import { DEFAULT_BASE_URL } from '../src/config'
import { EventLogProvider, useEventLog } from '../src/EventLog'
import { BaseUrlContext } from '../src/base-url'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <EventLogProvider>
        <Providers />
      </EventLogProvider>
    </SafeAreaProvider>
  )
}

/**
 * The base URL lives above `SuqoProvider` so the home screen can change it without a
 * restart — handy when switching between the mock server and a real deployment.
 */
function Providers() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL)
  const { record } = useEventLog()
  const insets = useSafeAreaInsets()

  return (
    <BaseUrlContext.Provider value={{ baseUrl, setBaseUrl }}>
      <SuqoProvider
        baseUrl={baseUrl}
        // This app has safe-area-context, so it passes real values rather than letting the
        // SDK fall back to its platform heuristic.
        insets={{ top: insets.top, bottom: insets.bottom }}
        debug
        onEvent={record}
      >
        <Stack screenOptions={{ headerTitleStyle: { fontSize: 16 } }}>
          <Stack.Screen name="index" options={{ title: 'SUQO SDK example' }} />
          <Stack.Screen name="await" options={{ title: 'await open()' }} />
          <Stack.Screen name="events" options={{ title: 'Event log' }} />
        </Stack>
      </SuqoProvider>
    </BaseUrlContext.Provider>
  )
}
