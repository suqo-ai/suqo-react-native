import { defineConfig } from 'vitest/config'

/**
 * One node environment for everything.
 *
 * Component tests render through `react-test-renderer` against **stubbed** `react-native`
 * and `react-native-webview` modules (`test/stubs/`), rather than the real ones. The real
 * packages ship Flow-typed source that needs Metro's babel pipeline to parse, which vite
 * does not run — and what these tests need to assert is our own behaviour (one callback per
 * open, the WebView mounting once, the pan thresholds), not React Native's.
 */
export default defineConfig({
  resolve: {
    alias: {
      'react-native-webview': new URL('./test/stubs/react-native-webview.tsx', import.meta.url)
        .pathname,
      'react-native': new URL('./test/stubs/react-native.tsx', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    coverage: { include: ['src/**'] },
  },
})
