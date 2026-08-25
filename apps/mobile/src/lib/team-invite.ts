/**
 * Message d'invitation d'équipe partagé (WhatsApp, SMS, etc.).
 * Le lien et le code sont sur leurs propres lignes pour un copier-coller facile.
 */
export function buildTeamInviteMessage(teamName: string, code: string, joinLink: string): string {
  return (
    `⚽ ${teamName} t'attend sur GBONHI FOOT !\n\n` +
    `Rejoins l'équipe directement dans l'application 👇\n${joinLink}\n\n` +
    `Code d'invitation :\n${code}\n\n` +
    `En cas de soucis avec le lien, ouvre l'app GBONHI FOOT, va dans « Rejoindre une équipe » dans le mode ligue et saisis le code ci-dessus.`
  );
}
