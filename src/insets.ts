/**
 * Vertical safe-area insets without `react-native-safe-area-context`.
 *
 * That library is the right answer and most apps already have it — but taking it as a peer
 * dependency would mean every consumer installs it plus its provider wiring, and this
 * package's whole shape is "one native dependency, works in Expo Go". So it heuristics, and
 * `SuqoProvider` takes an `insets` prop for apps that can supply exact values.
 *
 * The heuristic is honest about being one: it is documented in the README as the default, not
 * as a solved problem.
 *
 * @packageDocumentation
 */

import { useEffect, useState } from 'react'
import { Dimensions, Platform, StatusBar } from 'react-native'

import type { SuqoInsets } from './types'

/** iOS devices with a home indicator report a window at least this tall in portrait. */
const IOS_NOTCH_MIN_HEIGHT = 812
const IOS_HOME_INDICATOR = 34
const IOS_NOTCH_STATUS_BAR = 44
const IOS_LEGACY_STATUS_BAR = 20
/** Android nav bar and gesture pill both fall well inside this. */
const ANDROID_MAX_BOTTOM = 48

function measure(): SuqoInsets {
  const window = Dimensions.get('window')

  if (Platform.OS === 'android') {
    const screen = Dimensions.get('screen')
    const statusBar = StatusBar.currentHeight ?? 24
    // Whatever the screen has that the window does not, minus the status bar, is the
    // navigation bar or the gesture pill. Clamped, because on some devices the two
    // measurements disagree for reasons that have nothing to do with system chrome.
    const bottom = Math.min(
      Math.max(screen.height - window.height - statusBar, 0),
      ANDROID_MAX_BOTTOM
    )
    return { top: statusBar, bottom }
  }

  if (Platform.OS === 'ios') {
    const hasHomeIndicator = window.height >= IOS_NOTCH_MIN_HEIGHT
    return {
      top: hasHomeIndicator ? IOS_NOTCH_STATUS_BAR : IOS_LEGACY_STATUS_BAR,
      bottom: hasHomeIndicator ? IOS_HOME_INDICATOR : 0,
    }
  }

  return { top: 0, bottom: 0 }
}

/** The measured insets, or `override` verbatim when the host supplied one. */
export function useSafeInsets(override?: SuqoInsets): SuqoInsets {
  const [insets, setInsets] = useState<SuqoInsets>(() => override ?? measure())

  useEffect(() => {
    if (override) {
      setInsets(override)
      return
    }
    setInsets(measure())
    const subscription = Dimensions.addEventListener('change', () => setInsets(measure()))
    return () => subscription.remove()
  }, [override])

  return insets
}
