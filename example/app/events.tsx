import { ScrollView, Text, View } from 'react-native'

import { useEventLog } from '../src/EventLog'
import { Button, Mono, styles } from '../src/ui'

/**
 * Everything `onEvent` reported. A debug stream — the payment signal is the callbacks.
 */
export default function Events() {
  const { entries, clear } = useEventLog()

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Button title="Clear" variant="secondary" onPress={clear} />
      {entries.length === 0 ? (
        <Text style={{ color: '#8A929A' }}>Nothing yet. Start a payment.</Text>
      ) : (
        entries.map((entry, index) => (
          <View key={`${entry.at}-${index}`}>
            <Mono>
              {entry.at} {entry.text}
            </Mono>
          </View>
        ))
      )}
    </ScrollView>
  )
}
