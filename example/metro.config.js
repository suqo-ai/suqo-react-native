// Lets the example consume the package from source, one directory up.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const packageRoot = path.resolve(projectRoot, '..')

const config = getDefaultConfig(projectRoot)

// Metro does not follow a `file:` dependency outside the project root on its own.
config.watchFolders = [packageRoot]

/**
 * Force the shared singletons to this app's copies.
 *
 * The package keeps `react`, `react-native` and `react-native-webview` in its own
 * `node_modules` as devDependencies, because it needs their types to typecheck. Metro
 * resolves from the importing file outwards, so the SDK's sources find those copies first
 * and the bundle ends up with two React Natives. The symptom is not a resolution error but
 * a native one - `TurboModuleRegistry.getEnforcing('PlatformConstants') could not be found`
 * - because the second, unregistered copy is what the SDK runs against.
 *
 * `extraNodeModules` does not fix this: it is a fallback for resolution that *failed*, and
 * this resolution succeeds with the wrong copy. Redirecting the request is what works.
 */
const FORCED = ['react', 'react-native', 'react-native-webview']

const defaultResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forced = FORCED.find((name) => moduleName === name || moduleName.startsWith(name + '/'))

  if (forced) {
    const target = path.join(projectRoot, 'node_modules', forced) + moduleName.slice(forced.length)
    return context.resolveRequest(context, target, platform)
  }

  return (defaultResolveRequest || context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
