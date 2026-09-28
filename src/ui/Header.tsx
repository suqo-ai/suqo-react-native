import { Pressable, StyleSheet, Text, View } from 'react-native'

import { theme } from '../theme'

interface Props {
  title: string
  onBack(): void
}

/**
 * Title and a back affordance, and nothing else.
 *
 * There is no amount or seller name here on purpose: the payment page inside the WebView
 * renders both, from the session it already resolved. Repeating them in native chrome would
 * mean this SDK holding a second copy of figures it never fetched, and the two disagreeing
 * the moment an offer or a VAT rule changes.
 */
export function Header({ title, onBack }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={styles.back}
      >
        {/* Drawn from two rotated borders rather than an icon font or an SVG dependency. */}
        <View style={styles.chevron} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {/* Balances the back button so the title stays optically centred. */}
      <View style={styles.back} />
    </View>
  )
}

const CHEVRON = 10

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  back: { width: 40, alignItems: 'flex-start', justifyContent: 'center' },
  chevron: {
    width: CHEVRON,
    height: CHEVRON,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: theme.color.text,
    transform: [{ rotate: '45deg' }],
    marginLeft: 6,
  },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: theme.color.text },
})
