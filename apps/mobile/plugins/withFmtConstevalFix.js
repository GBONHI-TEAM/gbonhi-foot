/**
 * Config plugin — correctif `fmt` / `consteval` pour Xcode 26.4+ (Apple Clang 21).
 *
 * Contexte : React Native 0.76 (Expo SDK 52) embarque `fmt` 11.0.2 via RCT-Folly.
 * Le compilateur d'Xcode 26.4 applique des règles C++20 `consteval` plus strictes
 * qui font échouer la compilation de `fmt` (« call to consteval function … is not
 * a constant expression »). Le fix upstream (fmt 12.1.0) n'arrive qu'en SDK 56.
 *
 * Contournement : on désactive `FMT_USE_CONSTEVAL` dans `fmt/base.h`. `fmt` valide
 * alors les chaînes de format à l'EXÉCUTION au lieu de la compilation. Le binaire
 * produit est identique (les chaînes internes de fmt sont des littéraux corrects).
 *
 * Mécanique : on injecte un snippet dans le `post_install` du Podfile. Il s'exécute
 * après le téléchargement des pods (donc `Pods/fmt` existe) et avant la compilation.
 * À retirer une fois passé à React Native ≥ 0.83.9 / Expo SDK 56.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# >>> fmt-consteval-fix';

const SNIPPET = `
    ${MARKER} (Xcode 26.4+ / Apple Clang 21) — validation fmt à l'exécution
    fmt_base = File.join(__dir__, 'Pods', 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      original = File.read(fmt_base)
      patched = original.gsub('define FMT_USE_CONSTEVAL 1', 'define FMT_USE_CONSTEVAL 0')
      File.write(fmt_base, patched) if patched != original
    end
    # <<< fmt-consteval-fix
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes(MARKER)) {
        contents = contents.replace(
          /post_install do \|installer\|\n/,
          (m) => m + SNIPPET + '\n',
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
