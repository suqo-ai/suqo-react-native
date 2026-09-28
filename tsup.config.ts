import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  splitting: false,
  target: 'es2021',
  // React Native ships its own JSX runtime resolution; leave every peer external so the
  // consumer's bundler resolves them from their own tree, not ours.
  external: ['react', 'react/jsx-runtime', 'react-native', 'react-native-webview'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' }
  },
})
