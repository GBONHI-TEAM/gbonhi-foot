/**
 * Rôles administratifs officiels. Ils sont stockés côté serveur dans
 * `profiles.role` : `user_metadata` Supabase ne doit jamais autoriser une
 * action, car cette donnée est modifiable par le titulaire du compte.
 */
export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CONTROLEUR',
  'SUPPORT',
  'OPERATEUR',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(role: string | undefined): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

/** Normalise les anciennes valeurs déjà présentes dans la base. */
export function normalizeProfileRole(role: string | undefined): string {
  const normalized = (role ?? 'player').trim().toUpperCase();
  const aliases: Record<string, string> = {
    SUPERADMIN: 'SUPER_ADMIN',
    'SUPER-ADMIN': 'SUPER_ADMIN',
    CONTROLEUR: 'CONTROLEUR',
    'CONTRÔLEUR': 'CONTROLEUR',
    CONTROLLER: 'CONTROLEUR',
  };

  return aliases[normalized] ?? normalized;
}
