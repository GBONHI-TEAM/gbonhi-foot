/**
 * Copie tolérante : charge `expo-clipboard` de façon paresseuse. Si le module
 * natif n'est pas présent (build antérieur à l'ajout de la dépendance), on
 * échoue silencieusement au lieu de faire planter l'écran. Fonctionne dès qu'un
 * nouveau build natif inclut expo-clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // require paresseux : évite l'accès au module natif au chargement de l'écran.
    const Clipboard = require('expo-clipboard') as typeof import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
