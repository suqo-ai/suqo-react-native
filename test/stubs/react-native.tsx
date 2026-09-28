/**
 * A minimal stand-in for `react-native`, used only by the test suite.
 *
 * The real package ships Flow-typed source that needs Metro's babel pipeline to parse, which
 * vite does not run. Stubbing is not a workaround for that so much as the right scope: what
 * these tests assert is this package's own behaviour — that exactly one outcome is
 * delivered, that the WebView mounts once, that a drag past the threshold dismisses — none
 * of which is a statement about React Native's implementation.
 *
 * Anything the components actually touch is here, and behaves well enough to drive them.
 */
import { createElement } from 'react'
import type { ReactNode } from 'react'

type AnyProps = Record<string, unknown> & { children?: ReactNode }

const host = (name: string) => {
  const Component = (props: AnyProps) => createElement(name, props, props.children)
  Component.displayName = name
  return Component
}

export const View = host('View')
export const Text = host('Text')
export const Pressable = host('Pressable')
export const Modal = host('Modal')
export const ActivityIndicator = host('ActivityIndicator')

export const StyleSheet = {
  create: <T,>(styles: T): T => styles,
  absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hairlineWidth: 1,
  flatten: (style: unknown) => style,
}

export const Platform = { OS: 'ios' as 'ios' | 'android' | 'web', isPad: false, select: undefined }

export const StatusBar = { currentHeight: 24 }

let windowSize = { width: 390, height: 844 }
let screenSize = { width: 390, height: 844 }

export const Dimensions = {
  get: (key: 'window' | 'screen') => (key === 'window' ? windowSize : screenSize),
  set: (window: { width: number; height: number }, screen = window) => {
    windowSize = window
    screenSize = screen
  },
  addEventListener: (_event: string, _handler: (size: unknown) => void) => ({
    remove: () => {},
  }),
}

/** Records what was opened so a test can assert the handoff without a native module. */
export const Linking = {
  opened: [] as string[],
  canOpenURLResult: true,
  openURLError: null as Error | null,
  canOpenURL: async (url: string) => {
    void url
    return Linking.canOpenURLResult
  },
  openURL: async (url: string) => {
    if (Linking.openURLError) throw Linking.openURLError
    Linking.opened.push(url)
  },
  reset: () => {
    Linking.opened = []
    Linking.canOpenURLResult = true
    Linking.openURLError = null
  },
}

class AnimatedValue {
  #value: number
  #listeners = new Set<(state: { value: number }) => void>()

  constructor(value: number) {
    this.#value = value
  }

  setValue(value: number) {
    this.#value = value
    this.#listeners.forEach((listener) => listener({ value }))
  }

  stopAnimation() {}

  addListener(listener: (state: { value: number }) => void) {
    this.#listeners.add(listener)
    return 'id'
  }

  removeAllListeners() {
    this.#listeners.clear()
  }

  interpolate(config: { inputRange: number[]; outputRange: number[] } & Record<string, unknown>) {
    return { __interpolated: config, __value: this.#value }
  }

  __getValue() {
    return this.#value
  }
}

/**
 * Animations complete synchronously.
 *
 * Real timing is React Native's concern; what the suite needs is that the callback which
 * delivers the outcome runs, and that it runs after the close was requested.
 */
const run = (value: AnimatedValue, toValue: number) => ({
  start: (done?: (result: { finished: boolean }) => void) => {
    value.setValue(toValue)
    done?.({ finished: true })
  },
  stop: () => {},
})

/** Config is widened: the components pass real easing and spring parameters. */
type AnimConfig = { toValue: number } & Record<string, unknown>

export const Animated = {
  Value: AnimatedValue,
  View: host('Animated.View'),
  timing: (value: AnimatedValue, config: AnimConfig) => run(value, config.toValue),
  spring: (value: AnimatedValue, config: AnimConfig) => run(value, config.toValue),
}

export const Easing = {
  out: (fn: unknown) => fn,
  cubic: 'cubic' as unknown,
}

export interface PanResponderGesture {
  dx: number
  dy: number
  vx: number
  vy: number
}

type PanConfig = {
  onMoveShouldSetPanResponder?: (e: unknown, g: PanResponderGesture) => boolean
  onPanResponderGrant?: (e: unknown, g: PanResponderGesture) => void
  onPanResponderMove?: (e: unknown, g: PanResponderGesture) => void
  onPanResponderRelease?: (e: unknown, g: PanResponderGesture) => void
  onPanResponderTerminationRequest?: () => boolean
}

/**
 * Exposes the config back through `panHandlers` so a test can invoke the gesture callbacks
 * directly. Real RN passes these to the native responder system; the behaviour under test
 * is the thresholds in the config, not the responder negotiation.
 */
export const PanResponder = {
  create: (config: PanConfig) => ({ panHandlers: { __pan: config } }),
}

export const Keyboard = { addListener: () => ({ remove: () => {} }) }
export const BackHandler = { addEventListener: () => ({ remove: () => {} }) }
