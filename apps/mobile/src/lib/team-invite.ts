/**
 * Message d'invitation d'équipe partagé (WhatsApp, SMS, etc.).
 * Le lien et le code sont sur leurs propres lignes pour un copier-coller facile.
 */
export function buildTeamInviteMessage(teamName: string, _code: string, joinLink: string): string {
  // Le code n'est PAS inclus ici : il se partage séparément (message dédié)
  // pour que le destinataire puisse le copier seul, sans le reste du texte.
  return (
    `⚽ ${teamName} t'attend sur GBONHI FOOT !\n\n` +
    `Rejoins l'équipe directement dans l'application 👇\n${joinLink}\n\n` +
    `En cas de soucis avec le lien, ouvre l'app GBONHI FOOT, va dans « Rejoindre une équipe » dans le mode ligue et saisis le code d'invitation reçu.`
  );
}
