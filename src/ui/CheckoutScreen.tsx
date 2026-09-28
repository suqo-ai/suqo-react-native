import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { buildDebugScript } from '../bridge'
import type { InboundMessage } from '../bridge'
import { openExternal } from '../handoff'
import { useSafeInsets } from '../insets'
import { log } from '../log'
import type { CheckoutSession, Settlement } from '../session'
import { settlementFromResult } from '../session'
import { theme } from '../theme'
import type { SuqoEvent, SuqoInsets } from '../types'
import { CheckoutWebView } from './CheckoutWebView'
import type { WebViewHandlers } from './CheckoutWebView'
import { ErrorState } from './ErrorState'
import { Header } from './Header'

/**
 * Nothing came back at all. Generous on purpose: a cold Next.js compile on a dev server has
 * been measured at 4.8s, and a short deadline there draws a failure panel over a page that
 * was merely still building.
 */
const ALIVE_DEADLINE_MS = 12_000
/** The document is running our script but the block never mounted. */
const READY_DEADLINE_MS = 25_000

const OPEN_SPRING = { stiffness: 260, damping: 26, mass: 0.9 }
const CLOSE_DURATION_MS = 200

type Phase = 'loading' | 'ready' | 'error'

interface Props {
  session: CheckoutSession | null
  url: string
  title: string
  insets?: SuqoInsets
  onEvent?: (event: SuqoEvent) => void
  /** Forwards the page's own errors and requests to the console. */
  debug: boolean
  /** Incremented by the provider's `close()`. Any change closes the screen. */
  closeSignal: number
  /** Called once the screen has animated away and the outcome has been delivered. */
  onDismissed(): void
}

/**
 * The payment screen: full height, its own back button, and the page scrolling inside it.
 *
 * Presented as a full-screen `Modal` rather than a route in the host's navigator. That keeps
 * the SDK independent of which navigation library the app uses — there is nothing to
 * register and no route name to agree on — while still looking and behaving like a pushed
 * screen, including the hardware back button on Android.
 */
export function CheckoutScreen({
  session,
  url,
  title,
  insets,
  onEvent,
  debug,
  closeSignal,
  onDismissed,
}: Props) {
  const safeInsets = useSafeInsets(insets)
  const windowWidth = Dimensions.get('window').width

  // Mount is deliberately not `session !== null`: the Modal has to outlive the session by
  // one animation, or `animationType="none"` plus an instant unmount eats the exit.
  const [mounted, setMounted] = useState(false)
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorReason, setErrorReason] = useState<'alive' | 'ready' | 'load'>('alive')
  const [reloadKey, setReloadKey] = useState(0)

  // Slides in from the trailing edge, the way a pushed screen does, rather than up from the
  // bottom like a sheet.
  const translateX = useRef(new Animated.Value(windowWidth)).current

  const closingRef = useRef(false)
  const aliveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (aliveTimer.current) clearTimeout(aliveTimer.current)
    if (readyTimer.current) clearTimeout(readyTimer.current)
    aliveTimer.current = null
    readyTimer.current = null
  }, [])

  // A ref rather than state so that `settleAndClose` never goes stale inside a timer, which
  // captures its handler once.
  const sessionRef = useRef<CheckoutSession | null>(session)
  sessionRef.current = session

  const settleAndClose = useCallback(
    (settlement: Settlement) => {
      const current = sessionRef.current
      if (!current) return

      // Always offered to the latch, even mid-animation: a verified result arriving just
      // after a dismissal must be what the app hears about.
      current.settle(settlement)

      if (closingRef.current) return
      closingRef.current = true
      clearTimers()

      Animated.timing(translateX, {
        toValue: windowWidth,
        duration: CLOSE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        current.deliver()
        setMounted(false)
        onDismissed()
      })
    },
    [clearTimers, onDismissed, translateX, windowWidth]
  )

  /** Back button, or Android hardware back. An explicit dismissal either way. */
  const requestClose = useCallback(() => {
    settleAndClose({ result: 'closed' })
  }, [settleAndClose])

  /** Programmatic `close()`. Skipped on mount, when there is nothing open to close. */
  const seenCloseSignal = useRef(closeSignal)
  useEffect(() => {
    if (closeSignal === seenCloseSignal.current) return
    seenCloseSignal.current = closeSignal
    requestClose()
  }, [closeSignal, requestClose])

  /** Opens for a new session, resetting everything the previous one left behind. */
  useEffect(() => {
    if (!session) return

    closingRef.current = false
    setPhase('loading')
    setReloadKey(0)
    setMounted(true)
    translateX.setValue(windowWidth)
    onEvent?.({ type: 'open', sessionId: session.sessionId })

    return clearTimers
  }, [session, clearTimers, onEvent, translateX, windowWidth])

  /** Arms the load deadline whenever a fresh page starts loading. */
  useEffect(() => {
    if (!mounted || phase !== 'loading') return
    const current = sessionRef.current
    if (!current) return

    aliveTimer.current = setTimeout(() => {
      onEvent?.({ type: 'load_timeout', sessionId: current.sessionId, stage: 'alive' })
      setErrorReason('alive')
      setPhase('error')
    }, ALIVE_DEADLINE_MS)

    return () => {
      if (aliveTimer.current) clearTimeout(aliveTimer.current)
      aliveTimer.current = null
    }
  }, [mounted, phase, reloadKey, onEvent])

  const onShow = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      ...OPEN_SPRING,
      overshootClamping: true,
      useNativeDriver: true,
    }).start()
  }, [translateX])

  const handleMessage = useCallback(
    (message: InboundMessage) => {
      const current = sessionRef.current
      if (!current) return
      const sessionId = current.sessionId

      switch (message.type) {
        case 'suqo:alive': {
          if (aliveTimer.current) clearTimeout(aliveTimer.current)
          aliveTimer.current = null
          onEvent?.({ type: 'alive', sessionId })
          readyTimer.current = setTimeout(() => {
            onEvent?.({ type: 'load_timeout', sessionId, stage: 'ready' })
            setErrorReason('ready')
            setPhase('error')
          }, READY_DEADLINE_MS)
          break
        }
        case 'suqo:ready': {
          clearTimers()
          onEvent?.({ type: 'ready', sessionId })
          setPhase('ready')
          break
        }
        case 'suqo:resize': {
          // Reported to the host for its own logs, but nothing here is sized by it: the
          // screen is full height and the page scrolls inside it.
          onEvent?.({ type: 'resize', sessionId, height: message.height })
          break
        }
        case 'suqo:gateway': {
          // The page is navigating this WebView to a gateway. The screen stays exactly as it
          // is; the gateway's own page is what the buyer sees next, inside it.
          clearTimers()
          onEvent?.({ type: 'gateway', sessionId })
          setPhase('ready')
          break
        }
        case 'suqo:unavailable': {
          // Reported, not acted on. The page has already rendered its own explanation and the
          // buyer will dismiss, which settles as `closed`. Turning this into a failure would
          // tell the merchant a payment was attempted and rejected, when none was attempted.
          onEvent?.({ type: 'unavailable', sessionId, reason: message.reason })
          break
        }
        case 'suqo:debug': {
          // The page is otherwise opaque from out here: a hang and a throw look the same.
          log(`page.${message.level}`, { detail: message.text })
          break
        }
        case 'suqo:result': {
          settleAndClose(settlementFromResult(message.status, message.params, message.message))
          break
        }
      }
    },
    [clearTimers, onEvent, settleAndClose]
  )

  const handlers = useRef<WebViewHandlers>({
    onMessage: handleMessage,
    onHandoff: () => {},
    onLoadEnd: () => {},
    onLoadError: () => {},
  })

  handlers.current = {
    onMessage: handleMessage,
    onHandoff: (handoffUrl, scheme) => {
      const current = sessionRef.current
      if (!current) return
      onEvent?.({ type: 'handoff', sessionId: current.sessionId, scheme })
      void openExternal(handoffUrl).then((opened) => {
        if (opened) return
        onEvent?.({ type: 'handoff_failed', sessionId: current.sessionId, scheme })
      })
    },
    onLoadEnd: () => {
      // Not treated as "ready". The page reports that itself, and the distinction matters:
      // a document that loads but never boots the block is the failure the ready deadline
      // exists to catch.
      log('webview.loaded')
    },
    onLoadError: () => {
      const current = sessionRef.current
      if (current) onEvent?.({ type: 'load_error', sessionId: current.sessionId })
      setErrorReason('load')
      setPhase('error')
    },
  }

  const debugScript = useMemo(() => (debug ? buildDebugScript() : ''), [debug])

  return (
    <Modal
      visible={mounted}
      // The animation is ours: a trailing-edge slide rather than the platform's modal rise.
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
      hardwareAccelerated
      supportedOrientations={['portrait', 'landscape']}
      // Android hardware back. Closing is the right response: stepping the WebView back a
      // page mid-payment usually invalidates the gateway's session.
      onRequestClose={requestClose}
      onShow={onShow}
    >
      <Animated.View style={[styles.screen, { transform: [{ translateX }] }]}>
        <View style={{ height: safeInsets.top, backgroundColor: theme.color.surface }} />
        <Header title={title} onBack={requestClose} />

        <View style={styles.body}>
          {session ? (
            <CheckoutWebView
              key={`${session.key}:${reloadKey}`}
              url={url}
              debugScript={debugScript}
              handlers={handlers}
            />
          ) : null}

          {phase === 'loading' ? (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color={theme.color.primary} />
              <Text style={styles.loadingLabel}>Loading secure checkout</Text>
            </View>
          ) : null}

          {phase === 'error' ? (
            <View style={styles.overlay}>
              <ErrorState
                reason={errorReason}
                onRetry={() => {
                  setPhase('loading')
                  setReloadKey((value) => value + 1)
                }}
                onClose={requestClose}
              />
            </View>
          ) : null}
        </View>

        <View style={{ height: safeInsets.bottom, backgroundColor: theme.color.surface }} />
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.surface },
  // The WebView and the overlays are siblings filling the remaining height. The WebView is
  // never hidden, resized by phase, or wrapped in a changing parent — any of those remounts
  // it, and a remount reloads the gateway page underneath the buyer.
  body: { flex: 1 },
  // The edges are written out rather than spread from `StyleSheet.absoluteFillObject`: the
  // spread resolves to nothing in this package's bundle, and the overlay then lays out as an
  // ordinary flex child — a 71pt strip at the foot of the screen. The symptom is the one a
  // buyer sees: the page's own skeleton on screen with a stray spinner poking out below it,
  // instead of a loading state covering the page until it is ready.
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLabel: {
    marginTop: theme.space.lg,
    color: theme.color.muted,
    fontSize: 14,
  },
})
