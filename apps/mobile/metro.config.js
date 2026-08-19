// Metro config — Expo + NativeWind v4, compatible monorepo (Turborepo).
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Surveiller tout le monorepo (paquets partagés).
config.watchFolders = [monorepoRoot];

// 2. Résoudre les modules depuis le projet ET la racine (hoisting npm workspaces).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// 3. Stub des dépendances OPTIONNELLES de @supabase/supabase-js (tracing).
//    @opentelemetry/api n'est pas installé et n'est jamais utilisé à l'exécution ;
//    on le résout vers un module vide pour éviter l'échec de bundling (web + natif).
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@opentelemetry/api' || moduleName.startsWith('@opentelemetry/')) {
    return { type: 'empty' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
