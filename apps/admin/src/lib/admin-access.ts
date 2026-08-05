export const ADMIN_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CONTROLEUR',
  'SUPPORT',
  'OPERATEUR',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export function normalizeAdminRole(role: string | undefined): string {
  const normalized = (role ?? '').trim().toUpperCase();
  const aliases: Record<string, string> = {
    SUPERADMIN: 'SUPER_ADMIN',
    'SUPER-ADMIN': 'SUPER_ADMIN',
    'CONTRÔLEUR': 'CONTROLEUR',
    CONTROLLER: 'CONTROLEUR',
  };
  return aliases[normalized] ?? normalized;
}

export function isAdminRole(role: string | undefined): role is AdminRole {
  return ADMIN_ROLES.includes(normalizeAdminRole(role) as AdminRole);
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Administrateur',
  CONTROLEUR: 'Contrôleur',
  SUPPORT: 'Support',
  OPERATEUR: 'Opérateur',
};
