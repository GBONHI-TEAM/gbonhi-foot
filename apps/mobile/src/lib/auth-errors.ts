/**
 * Traduit en français les messages d'erreur d'authentification (Supabase Auth
 * renvoie ses messages en anglais). On mappe les cas connus ; sinon on renvoie
 * un message générique en français plutôt que l'anglais brut.
 */
export function frenchAuthError(raw?: string | null): string {
  const msg = (raw ?? '').trim();
  if (!msg) return 'Une erreur est survenue. Réessaie.';

  // Limitation anti-spam : « For security purposes, you can only request this after N seconds. »
  const rate = msg.match(/only request this after (\d+) seconds?/i);
  if (rate) {
    const s = Number(rate[1]);
    return `Pour des raisons de sécurité, patiente ${s} seconde${s > 1 ? 's' : ''} avant de redemander un code.`;
  }

  if (/rate limit/i.test(msg)) {
    return 'Trop de tentatives. Réessaie dans quelques minutes.';
  }
  if (/invalid.*email|email.*invalid/i.test(msg)) {
    return 'Cette adresse e-mail n’est pas valide.';
  }
  if (/(token has expired|expired or is invalid|invalid token|otp.*expired|expired.*otp)/i.test(msg)) {
    return 'Code invalide ou expiré. Redemande un nouveau code.';
  }
  if (/invalid.*(otp|code|credentials)/i.test(msg)) {
    return 'Code incorrect. Vérifie le code reçu et réessaie.';
  }
  if (/(signups? not allowed|user not found|user already registered)/i.test(msg)) {
    return "Ce numéro n'est pas utilisable pour cette action.";
  }
  if (/network|fetch|timeout/i.test(msg)) {
    return 'Connexion au serveur impossible. Vérifie ta connexion internet.';
  }

  // Cas inconnu : éviter d'afficher un message en anglais à l'utilisateur.
  return 'Connexion impossible pour le moment. Réessaie dans un instant.';
}
