import { PUBLIC_LINK_BASE } from './api';

/**
 * Lien de téléchargement / ouverture de l'app partagé dans les invitations.
 * Pointe vers la page smart-link `/download` du backend : elle tente d'ouvrir
 * l'app si installée, sinon redirige vers le bon store (iOS/Android) — les
 * URLs stores se configurent côté serveur (env) à la publication.
 */
export const APP_DOWNLOAD_URL = `${PUBLIC_LINK_BASE}/download`;

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

/**
 * Message dédié au partage du CODE d'invitation : fun et complet, avec le code
 * bien visible (sur sa propre ligne, copiable), la marche à suivre, un lien pour
 * télécharger/ouvrir l'app et un lien pour rejoindre directement.
 */
export function buildTeamInviteCodeMessage(teamName: string, code: string, joinLink: string): string {
  return (
    `⚽🔥 Rejoins mon équipe « ${teamName} » sur GBONHI FOOT ! 🇨🇮\n\n` +
    `🔑 Code d'invitation :\n${code}\n\n` +
    `👉 Comment nous rejoindre :\n` +
    `1️⃣ Ouvre ou télécharge l'app GBONHI FOOT : ${APP_DOWNLOAD_URL}\n` +
    `2️⃣ Va dans « Rejoindre une équipe » (mode Ligue)\n` +
    `3️⃣ Saisis le code : ${code}\n\n` +
    `⚡ Ou rejoins directement en un clic 👇\n${joinLink}\n\n` +
    `On t'attend sur le terrain ! 🏆`
  );
}
