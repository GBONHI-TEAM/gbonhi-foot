/**
 * Config plugin — plancher iOS 15.1 pour TOUTES les cibles Pods (Xcode 27).
 * expo-build-properties ne relève que les cibles principales des pods,
 * pas les bundles de ressources (SDWebImage 9.0, ReachabilitySwift 12.0,
 * RNCAsyncStorage_resources 13.4) que Xcode 27 refuse.
 * À retirer une fois passé à un SDK qui gère ce plancher nativement.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# >>> pods-deployment-target-floor';

const SNIPPET = `
    ${MARKER} (Xcode 27 — plancher 15.1 pour toutes les cibles Pods, bundles de ressources inclus)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = (config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] || '0').to_f
        config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1' if current < 15.1
      end
    end
    # <<< pods-deployment-target-floor
`;

module.exports = function withPodsDeploymentTargetFloor(config) {
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
