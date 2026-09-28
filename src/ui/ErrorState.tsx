import { Pressable, StyleSheet, Text, View } from 'react-native'

import { theme } from '../theme'

interface Props {
  /** Which deadline elapsed, or a load failure. Decides the copy, not the layout. */
  reason: 'alive' | 'ready' | 'load'
  onRetry(): void
  onClose(): void
}

const COPY: Record<Props['reason'], { title: string; body: string }> = {
  alive: {
    title: "Couldn't reach the payment page",
    body: 'Check the connection and try again.',
  },
  ready: {
    title: 'The payment page is taking too long',
    body: 'It loaded but never finished starting up.',
  },
  load: {
    title: "Couldn't load the payment page",
    body: 'Check the connection and try again.',
  },
}

/**
 * Shown when a deadline elapses or the page fails to load.
 *
 * It reports a *loading* failure and nothing about the payment, because at this point no
 * payment has been attempted. Retry remounts the WebView; close settles the session as
 * dismissed.
 */
export function ErrorState({ reason, onRetry, onClose }: Props) {
  const copy = COPY[reason]

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>
      <Pressable style={styles.retry} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
      <Pressable style={styles.close} onPress={onClose} accessibilityRole="button">
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space.xl },
  title: { fontSize: 16, fontWeight: '600', color: theme.color.text, textAlign: 'center' },
  body: {
    marginTop: theme.space.sm,
    fontSize: 14,
    color: theme.color.muted,
    textAlign: 'center',
  },
  retry: {
    marginTop: theme.space.xl,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.xl,
    borderRadius: theme.radius.button,
    backgroundColor: theme.color.primary,
  },
  retryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  close: { marginTop: theme.space.md, padding: theme.space.sm },
  closeText: { color: theme.color.muted, fontSize: 14 },
})
