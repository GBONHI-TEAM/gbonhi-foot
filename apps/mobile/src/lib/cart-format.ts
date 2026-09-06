import type { ImageSourcePropType } from 'react-native';

/** Durée de maintien d'un créneau réservé dans le panier (15 min). */
export const HOLD_DURATION_MS = 15 * 60 * 1000;

/**
 * Habillage de marque des moyens de paiement (logo). Pas de sous-titre
 * répétitif : tous les mobile money sont « instantanés » et leur nom est déjà
 * affiché. On ne garde une mention que là où elle apporte une info utile (cash).
 */
export const METHOD_META: Record<string, { logo?: ImageSourcePropType; fit?: 'cover' | 'contain'; emoji?: string; subtitle?: string }> = {
  cash: { emoji: '💵', subtitle: 'À régler sur place' },
  wave: { logo: require('../../assets/images/pay-wave.png') },
  orange: { logo: require('../../assets/images/pay-orange.webp') },
  mtn: { logo: require('../../assets/images/pay-mtn.png') },
  moov: { logo: require('../../assets/images/pay-moov.png'), fit: 'contain' },
  card: { emoji: '💳' },
};

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date à confirmer'
    : `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function time(value: number): string {
  const hour = Math.floor(value);
  return `${String(hour).padStart(2, '0')}h${value % 1 === 0.5 ? '30' : '00'}`;
}

export function timeRemaining(createdAt: string, now: number): string {
  const remaining = Math.max(0, HOLD_DURATION_MS - (now - new Date(createdAt).getTime()));
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function isReservationExpired(createdAt: string, now: number): boolean {
  return new Date(createdAt).getTime() + HOLD_DURATION_MS <= now;
}
