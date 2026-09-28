import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

export function Field({
  label,
  value,
  onChangeText,
  autoCapitalize = 'none',
}: {
  label: string
  value: string
  onChangeText(text: string): void
  autoCapitalize?: 'none' | 'words'
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  )
}

export function Button({
  title,
  onPress,
  variant = 'primary',
}: {
  title: string
  onPress(): void
  variant?: 'primary' | 'secondary'
}) {
  return (
    <Pressable
      style={[styles.button, variant === 'secondary' && styles.buttonSecondary]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>
        {title}
      </Text>
    </Pressable>
  )
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  )
}

export function Mono({ children }: { children: ReactNode }) {
  return <Text style={styles.mono}>{children}</Text>
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F6FA' },
  content: { padding: 16, gap: 12 },
  field: { gap: 4 },
  label: { fontSize: 12, color: '#667080', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: '#EAEAEA',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0D062D',
  },
  button: {
    backgroundColor: '#635BFF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonSecondary: { backgroundColor: '#EFEFFF' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  buttonTextSecondary: { color: '#635BFF' },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    padding: 14,
    gap: 6,
  },
  panelTitle: { fontSize: 13, fontWeight: '600', color: '#0D062D' },
  mono: { fontFamily: 'Courier', fontSize: 12, color: '#425466' },
})
