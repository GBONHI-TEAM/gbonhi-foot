import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { apiClient } from './api';

/** Canal Android unique, déclaré avant la demande de permission. */
export const PUSH_CHANNEL_ID = 'gbonhi-notifications';

/**
 * Enregistrement des notifications push Expo.
 *
 * - Les notifications IN-APP (écran + badge, via GET /notifications) fonctionnent
 *   toujours, indépendamment du push OS.
 * - Le push OS nécessite un vrai `eas.projectId` (app.json) + un appareil physique.
 *   Si le token ne peut pas être obtenu (simulateur, projectId placeholder, perms
 *   refusées), on abandonne silencieusement sans casser le flux de connexion.
 */

// Affiche les notifications même app au premier plan.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let lastRegisteredToken: string | null = null;

function resolveProjectId(): string | undefined {
  const anyConst = Constants as unknown as {
    expoConfig?: { extra?: { eas?: { projectId?: string } } };
    easConfig?: { projectId?: string };
  };
  const id = anyConst.expoConfig?.extra?.eas?.projectId || anyConst.easConfig?.projectId;
  if (!id || id === 'YOUR_EAS_PROJECT_ID') return undefined;
  return id;
}

export async function registerForPushNotifications(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
        name: 'Notifications GBONHI FOOT',
        description: 'Matchs, réservations, équipes et activité de la communauté.',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 250, 180, 250],
        enableLights: true,
        lightColor: '#F7921E',
        showBadge: true,
      });
    }

    const settings = await Notifications.getPermissionsAsync();
    let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    }
    if (!granted) return;

    const projectId = resolveProjectId();
    if (!projectId) {
      // Pas de projet EAS configuré → on ne peut pas obtenir de token push OS.
      // Les notifications in-app restent fonctionnelles.
      console.log('[push] projectId EAS absent — push OS désactivé (in-app OK).');
      return;
    }

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResp.data;
    if (!token || token === lastRegisteredToken) return;

    await apiClient.post('/api/v1/notifications/token', { token });
    lastRegisteredToken = token;
    console.log('[push] token enregistré');
  } catch (e) {
    console.log('[push] enregistrement ignoré:', e instanceof Error ? e.message : String(e));
  }
}
