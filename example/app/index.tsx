import { Link } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'

import { useSuqoCheckout } from '@suqo/react-native'

import { useBaseUrl } from '../src/base-url'
import { DEFAULT_SESSION_ID } from '../src/config'
import { useEventLog } from '../src/EventLog'
import { Button, Field, Mono, Panel, styles } from '../src/ui'

/**
 * The callback form: one of onSuccess / onFailure / onClose fires, and the screen shows
 * which one did and what it carried.
 */
export default function Home() {
  const { open } = useSuqoCheckout()
  const { baseUrl, setBaseUrl } = useBaseUrl()
  const { push } = useEventLog()

  const [sessionId, setSessionId] = useState(DEFAULT_SESSION_ID)
  const [last, setLast] = useState<{ callback: string; detail: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const record = (callback: string, detail: unknown) => {
    setLast({ callback, detail: JSON.stringify(detail, null, 2) })
  }

  const pay = () => {
    setLast(null)
    setError(null)

    open({
      sessionId,
      onSuccess: (result) => {
        // The cue to move the buyer on. Fulfilment is still decided by your own backend,
        // from the webhook.
        record('onSuccess', result)
      },
      onFailure: (result) => {
        // `cancelled` and `failed` need opposite handling: offer the basket again vs look
        // into the payment.
        record('onFailure', result)
      },
      onClose: () => record('onClose', { dismissed: true }),
    }).catch((reason: unknown) => {
      // Rejects for a checkout already open, or a session id that cannot make a URL —
      // both before the sheet appears.
      const message = reason instanceof Error ? reason.message : String(reason)
      setError(message)
      push(`rejected: ${message}`)
    })
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Field label="Base URL" value={baseUrl} onChangeText={setBaseUrl} />
      <Field label="Checkout session id" value={sessionId} onChangeText={setSessionId} />

      <Button title="Pay" onPress={pay} />

      {error ? (
        <Panel title="open() rejected">
          <Mono>{error}</Mono>
        </Panel>
      ) : null}

      {last ? (
        <Panel title={`${last.callback} fired`}>
          <Mono>{last.detail}</Mono>
        </Panel>
      ) : null}

      <View style={{ gap: 8 }}>
        <Link href="/await" asChild>
          <Button title="Try the await form" variant="secondary" onPress={() => {}} />
        </Link>
        <Link href="/events" asChild>
          <Button title="Event log" variant="secondary" onPress={() => {}} />
        </Link>
      </View>

      <Text style={{ color: '#667080', fontSize: 12 }}>
        No backend? Run `npm run mock` in the example folder and paste the LAN address it prints as
        the base URL.
      </Text>
    </ScrollView>
  )
}
