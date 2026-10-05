import { useMemo, useState } from 'react'
import { ScrollView } from 'react-native'

import { resolveBaseUrl, useSuqoCheckout } from '@suqo/react-native'

import { useBaseUrl } from '../src/base-url'
import { DEFAULT_SESSION_ID } from '../src/config'
import { Button, Field, Mono, Panel, styles } from '../src/ui'

/**
 * The same flow with `await` instead of callbacks. `open()` resolves with the outcome, so a
 * screen that just wants to branch on the result does not need three handlers.
 */
export default function AwaitScreen() {
  const { open } = useSuqoCheckout()
  const { mode, override } = useBaseUrl()
  const resolvedBaseUrl = useMemo(
    () => resolveBaseUrl(override.trim() === '' ? undefined : override, mode),
    [override, mode]
  )
  const [sessionId, setSubscriptionId] = useState(DEFAULT_SESSION_ID)
  const [outcome, setOutcome] = useState<string | null>(null)

  const pay = async () => {
    setOutcome('waiting…')
    try {
      const result = await open({ sessionId })
      setOutcome(JSON.stringify(result, null, 2))
    } catch (reason) {
      setOutcome(`rejected: ${reason instanceof Error ? reason.message : String(reason)}`)
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Panel title="Base URL">
        <Mono>{resolvedBaseUrl}</Mono>
      </Panel>
      <Field label="Subscription id" value={sessionId} onChangeText={setSubscriptionId} />
      <Button title="await open()" onPress={pay} />
      {outcome ? (
        <Panel title="Resolved">
          <Mono>{outcome}</Mono>
        </Panel>
      ) : null}
    </ScrollView>
  )
}
