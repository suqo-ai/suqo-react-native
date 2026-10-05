import type { ReactNode } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import type { CheckoutMode } from '@suqo/react-native'

/**
 * A harness, not a demo — the same dark control-panel look as the web package's example, so
 * both SDKs read as one product. Plain `StyleSheet`, no custom font asset: the mono look
 * comes from the platform's own monospace fallback.
 */

const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

export function Field({
  label,
  value,
  onChangeText,
  autoCapitalize = 'none',
  placeholder,
}: {
  label: string
  value: string
  onChangeText(text: string): void
  autoCapitalize?: 'none' | 'words'
  placeholder?: string
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
        placeholder={placeholder}
        placeholderTextColor="#4A535C"
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
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonTextSecondary]}>
        {title}
      </Text>
    </Pressable>
  )
}

/** The mode control. Live is styled as a hazard, not a neutral option. */
export function ModeSwitch({
  value,
  onChange,
}: {
  value: CheckoutMode
  onChange(mode: CheckoutMode): void
}) {
  return (
    <View style={styles.modeSwitch}>
      <Pressable
        style={[styles.modeOption, value === 'sandbox' && styles.modeOptionSandboxActive]}
        onPress={() => onChange('sandbox')}
      >
        <Text style={[styles.modeOptionText, value === 'sandbox' && styles.modeTextSandboxActive]}>
          SANDBOX
        </Text>
      </Pressable>
      <Pressable
        style={[styles.modeOption, value === 'live' && styles.modeOptionLiveActive]}
        onPress={() => onChange('live')}
      >
        <Text style={[styles.modeOptionText, value === 'live' && styles.modeTextLiveActive]}>
          LIVE
        </Text>
      </Pressable>
    </View>
  )
}

export function StatusLine({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <View style={styles.statusLine}>
      <View style={[styles.dot, danger ? styles.dotDanger : styles.dotSafe]} />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  )
}

export function LiveBanner() {
  return (
    <View style={styles.liveBanner}>
      <View style={[styles.dot, styles.dotDanger]} />
      <Text style={styles.liveBannerText}>
        LIVE mode — this points at app.suqo.ai and can move real money.
      </Text>
    </View>
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

const BG = '#0B0D10'
const PANEL = '#14171B'
const PANEL_RAISED = '#1A1E23'
const LINE = '#262B31'
const INK = '#D9DDE1'
const INK_DIM = '#8A929A'
const INK_FAINT = '#4A535C'
const SAFE = '#35D08F'
const SAFE_DIM = '#1D4D3B'
const DANGER = '#FF5D5D'
const DANGER_DIM = '#5A2222'

export const colors = { BG, PANEL, INK, INK_DIM, SAFE, DANGER }

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  field: { gap: 6 },
  label: {
    fontSize: 11,
    color: INK_DIM,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: mono,
  },
  input: {
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: BG,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: INK,
    fontFamily: mono,
  },
  button: {
    backgroundColor: SAFE,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonSecondary: {
    backgroundColor: PANEL_RAISED,
    borderWidth: 1,
    borderColor: LINE,
  },
  buttonText: { color: '#04140C', fontSize: 14, fontWeight: '700', fontFamily: mono },
  buttonTextSecondary: { color: INK, fontWeight: '600' },
  modeSwitch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 999,
    padding: 3,
    backgroundColor: BG,
    gap: 4,
    alignSelf: 'flex-start',
  },
  modeOption: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  modeOptionSandboxActive: { backgroundColor: SAFE_DIM },
  modeOptionLiveActive: { backgroundColor: DANGER_DIM },
  modeOptionText: {
    fontSize: 11,
    letterSpacing: 1,
    color: INK_DIM,
    fontFamily: mono,
    fontWeight: '600',
  },
  modeTextSandboxActive: { color: SAFE },
  modeTextLiveActive: { color: DANGER },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 12, color: INK_DIM, fontFamily: mono },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotSafe: { backgroundColor: SAFE },
  dotDanger: { backgroundColor: DANGER },
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: DANGER_DIM,
    borderWidth: 1,
    borderColor: 'rgba(255,93,93,0.4)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  liveBannerText: { color: '#FFD4D4', fontSize: 12, flex: 1, fontFamily: mono },
  panel: {
    backgroundColor: PANEL,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LINE,
    padding: 14,
    gap: 8,
  },
  panelTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: INK_FAINT,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontFamily: mono,
  },
  mono: { fontFamily: mono, fontSize: 12, color: '#9AA4AD' },
})
