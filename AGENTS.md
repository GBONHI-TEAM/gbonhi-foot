---
description: Instructions complètes pour les agents IA développant GBONHI FOOT
globs: "*"
alwaysApply: true
---

# AGENTS.md — GBONHI FOOT
> Guide de développement de bout en bout — Mise à jour : 2026-07-22

---

## 1. CONTEXTE PROJET

Plateforme football communautaire pour la Côte d'Ivoire. Monorepo Turborepo avec 4 applications :

| App | Technologie | Usage |
|---|---|---|
| `apps/mobile/` | React Native + Expo SDK 52 | App joueurs (iOS + Android) |
| `apps/admin/` | Next.js 15 + shadcn/ui | Back-office admin GBONHI FOOT |
| `apps/partner/` | Next.js 15 + shadcn/ui | Portail propriétaires terrains |
| `backend/` | NestJS 11 + Fastify + Prisma 6 | API REST commune |

**Toujours lire les fichiers context AVANT de coder.** Ils contiennent toute la vérité du produit.

---

## 2. ORDRE DE LECTURE DES FICHIERS CONTEXT

Lire dans cet ordre avant toute implémentation :

```
1. context/project-overview.md     → vision produit, users, flows, tous les écrans
2. context/architecture.md         → stack technique, monorepo, modules backend, flux Realtime
3. context/business-rules.md       → logique métier COMPLÈTE (ligues, matchs, compositions, rôles, etc.)
4. context/features.md             → inventaire features par plateforme
5. context/build-plan.md           → plan de build, toutes les phases, écrans numérotés
6. context/design/design-system.md → palette officielle, composants, règles visuelles
7. context/ui-registry.md          → chemins fichiers cibles pour CHAQUE écran et composant
8. context/ui-rules.md             → règles UI par plateforme (nav, couleurs, comportements)
9. context/progress-tracker.md     → état actuel, décisions prises, ce qui reste
10. context/design/mockups/        → images de référence des maquettes validées
```

---

## 3. STACK TECHNIQUE

**TypeScript strict partout. Aucun `any`. Aucun `// @ts-ignore`.**

### Backend (NestJS 11)
- Framework : NestJS 11 + Fastify adapter
- ORM : Prisma 6 (seul ORM — pas de raw SQL sauf `prisma.$queryRaw` si nécessaire)
- Auth : Supabase Auth — validation JWT dans `JwtGuard`, pas de session côté NestJS
- Validation : `class-validator` + `class-transformer` sur tous les DTOs
- Rate limiting : `@nestjs/throttler` (mémoire — pas de Redis)
- Guards : `JwtGuard` + `RoleGuard` sur toutes les routes protégées

### Frontend Web (Next.js 15)
- Routing : App Router (pas Pages Router)
- Composants : shadcn/ui + Tailwind CSS
- State serveur : React Server Components par défaut
- State client : `useState` / `useReducer` uniquement si nécessaire
- Data fetching : TanStack Query v5 (`@tanstack/react-query`) côté client
- Auth web : Supabase SSR (`@supabase/ssr`) + middleware Next.js

### Mobile (React Native + Expo)
- Routing : Expo Router v4 (file-based)
- Styling : NativeWind v4 (Tailwind syntax)
- State global : Zustand v5
- Data fetching : TanStack Query v5
- Auth : Supabase Auth (OTP SMS + Google OAuth)
- Push : Expo Push Notifications

### Base de données
- Supabase PostgreSQL Pro (Frankfurt)
- RLS (Row Level Security) **obligatoire** sur toutes les tables
- Realtime activé sur : `match_events`, `slots` (créneaux)
- Migrations : `supabase/migrations/` — toujours via `supabase migration new`

### Paiements
- Provider : CinetPay (agrège Wave · Orange Money · MTN Moov · Visa/MC)
- Flux : initiate → redirect → webhook → confirm reservation
- Commission GBONHI : 10% sur réservations terrain

---

## 4. COULEURS OFFICIELLES (JAMAIS DÉVIER)

```typescript
// Toujours utiliser ces tokens — jamais de hex hardcodé inline
const colors = {
  primary:      '#1E7A3A',  // Vert ivoirien officiel — headers, sidebar admin
  primaryMedium:'#2E9E4F',  // Vert secondaire — hover states
  primaryDark:  '#0F3D1E',  // Vert très foncé — sidebar partner
  primaryDeep:  '#0D1F0D',  // Vert quasi-noir — fond global mobile
  accent:       '#F7921E',  // Orange officiel — CTAs, prix, highlights
  accentGold:   '#FFB830',  // Or/doré — récompenses, badges
  accentDark:   '#E07010',  // Orange foncé — pressed state
};
```

**Règles absolues :**
- ⛔ Sidebar Admin BO = `#1E7A3A` (jamais `#2D6A4F`)
- ⛔ Sidebar Partner = `#1A3D2B`
- ⛔ Filtre période = chip "Période" (jamais "Personnalisé")
- ⛔ Motifs = "motifs géométriques ivoiriens" (jamais "kente")
- ⛔ Aucun glow/halo sur les boutons CTA orange (exception : logo Splash Screen)

---

## 5. RÔLES ADMIN BO (5 RÔLES OFFICIELS)

```typescript
enum AdminRole {
  SUPER_ADMIN  = 'SUPER_ADMIN',   // Accès complet + gestion rôles
  ADMIN        = 'ADMIN',          // Accès opérationnel complet
  CONTROLEUR   = 'CONTROLEUR',     // Identification + Live + incidents
  SUPPORT      = 'SUPPORT',        // Tickets support uniquement
  OPERATEUR    = 'OPERATEUR',      // Consultation + opérations basiques
}
```

⛔ Les anciens rôles `admin / finance / superviseur` sont **obsolètes**.
Référence matrice complète : `context/business-rules.md §5`

---

## 6. ORDRE DE DÉVELOPPEMENT

### Séquence recommandée

```
Phase 1 : Backend Foundation     (J1–J5)
Phase 2 : Backend Modules Core   (J6–J20)
Phase 3 : Admin BO               (J21–J45)
Phase 4 : Partner Portal         (J46–J60)
Phase 5 : Mobile App             (J61–J100)
```

### Phase 1 — Backend Foundation

**Livrable : API NestJS démarre, Supabase connecté, Auth fonctionnel**

```bash
# Vérifier que tout tourne
cd gbonhi-foot
turbo dev

# Vérifier migrations Supabase
npx supabase db status
npx supabase generate types typescript --local > packages/types/src/database.types.ts
```

Fichiers à créer/vérifier :
- `backend/src/main.ts` — bootstrap Fastify + CORS + validation pipe global
- `backend/src/prisma/prisma.service.ts` — PrismaService global
- `backend/src/common/guards/jwt.guard.ts` — validation JWT Supabase
- `backend/src/common/guards/role.guard.ts` — vérif `AdminRole` depuis JWT claims
- `backend/src/common/decorators/roles.decorator.ts`
- `.env` template dans chaque app (voir §10)

### Phase 2 — Backend Modules (dans cet ordre)

Pour chaque module, créer : `module / controller / service / dto / entity`

| Ordre | Module | Priorité | Notes clés |
|---|---|---|---|
| 1 | `users/` | P0 | `UserMode` = 'leagues' \| 'reservation' · PlayerProfile lazy |
| 2 | `teams/` | P0 | 1 équipe = 1 terrain domicile obligatoire (terrain partenaire existant) |
| 3 | `terrains/` | P0 | Tarifs par durée/surface · Horaires · GPS · Appartient à un partner |
| 4 | `leagues/` | P0 | 7 statuts · round-robin calendar · standings auto trigger SQL |
| 5 | `calendar/` | P0 | Génération round-robin (N/2 domicile + N/2 extérieur) · 4 statuts |
| 6 | `matches/` | P0 | 10 statuts · matchs du jour auto-view · events |
| 7 | `compositions/` | P0 | Deadline J-24h · forfait auto 3-0 · notifs J-48h/J-20h/J-12h |
| 8 | `results/` | P1 | 5 statuts · validation CONTRÔLEUR · contestation |
| 9 | `reservations/` | P0 | Webhook paiement → confirm · Realtime sync créneaux |
| 10 | `payments/` | P0 | CinetPay initiate/webhook · commission 10% |
| 11 | `partner/` | P1 | Revenus partenaire · net reversé = brut − 10% |
| 12 | `roles/` | P1 | Matrice 5 rôles × 19 modules · Audit Log 24 mois |
| 13 | `incidents/` | P1 | Signalements · suspension auto (3ème jaune → 1 match, rouge → 1+) |
| 14 | `notifications/` | P1 | Expo Push · 13 types catalogués dans business-rules.md §7 |
| 15 | `community/` | P2 | Posts · réactions football (5 types) · GBONHI bot |

### Phase 3 — Admin BO (ordre des écrans)

Référence fichiers : `context/ui-registry.md` section "Admin Back-Office"
Référence maquettes : `context/design/mockups/admin/exports/`

| Ordre | Écran | Fichier cible |
|---|---|---|
| 1 | Login | `apps/admin/app/(auth)/login/page.tsx` |
| 2 | Dashboard Opérations | `apps/admin/app/(dashboard)/page.tsx` |
| 3 | Ligues · Liste | `apps/admin/app/(dashboard)/leagues/page.tsx` |
| 4 | Ligues · Créer (modal) | _(modal dans leagues/page.tsx)_ |
| 5 | Matchs · Matchs du jour | `apps/admin/app/(dashboard)/matches/page.tsx` |
| 6 | Matchs · Détail | `apps/admin/app/(dashboard)/matches/[id]/page.tsx` |
| 7 | Matchs · Identification Contrôleur | `apps/admin/app/(dashboard)/matches/[id]/identification/page.tsx` |
| 8 | Matchs · Saisie Live | `apps/admin/app/(dashboard)/matches/[id]/live/page.tsx` |
| 9 | Calendrier | `apps/admin/app/(dashboard)/calendar/page.tsx` |
| 10 | Classements | `apps/admin/app/(dashboard)/standings/page.tsx` |
| 11 | Terrains · Liste | `apps/admin/app/(dashboard)/terrains/page.tsx` |
| 12 | Terrains · Ajouter/Modifier | _(drawer dans terrains/page.tsx)_ |
| 13 | Réservations en direct | `apps/admin/app/(dashboard)/reservations-live/page.tsx` |
| 14 | Utilisateurs | `apps/admin/app/(dashboard)/users/page.tsx` |
| 15 | Équipes · Liste | `apps/admin/app/(dashboard)/teams/page.tsx` |
| 16 | Équipes · Détail (drawer) | _(drawer dans teams/page.tsx)_ |
| 16b | Équipes · Fiche joueur (slide-over) | _(slide-over dans teams/page.tsx)_ |
| 17 | Dashboard Finance | `apps/admin/app/(dashboard)/finance/page.tsx` |
| 18 | Finance · Partenaires à payer | `apps/admin/app/(dashboard)/finance/partners/page.tsx` |
| 19 | Finance · Déclarer coûts | _(modal dans finance/page.tsx)_ |
| 20 | KPI Acquisition & Fidélisation | `apps/admin/app/(dashboard)/kpi/acquisition/page.tsx` |
| 21 | KPI Ligues | `apps/admin/app/(dashboard)/kpi/leagues/page.tsx` |
| 22 | KPI Réservations | `apps/admin/app/(dashboard)/kpi/reservations/page.tsx` |
| 23 | Ligues · Résultats | `apps/admin/app/(dashboard)/leagues/[id]/results/page.tsx` |
| 24 | Incidents · Liste | `apps/admin/app/(dashboard)/incidents/page.tsx` |
| 25 | Incidents · Formulaire | _(drawer dans incidents/page.tsx)_ |
| 26 | Avis utilisateurs | `apps/admin/app/(dashboard)/reviews/page.tsx` |
| 27 | Support · Tickets | `apps/admin/app/(dashboard)/support/page.tsx` |
| 28 | Push Notifications | `apps/admin/app/(dashboard)/notifications/page.tsx` |
| 29 | Rôles & Accès | `apps/admin/app/(dashboard)/roles/page.tsx` |

### Phase 4 — Partner Portal (ordre des écrans)

Référence fichiers : `context/ui-registry.md` section "Portail Partenaire"
Référence maquettes : `context/design/mockups/partner/exports/`

| Ordre | Écran | Fichier cible |
|---|---|---|
| 1 | Login | `apps/partner/app/(auth)/login/page.tsx` |
| 2 | Tableau de bord | `apps/partner/app/(dashboard)/page.tsx` |
| 3 | Mon terrain | `apps/partner/app/(dashboard)/terrain/page.tsx` |
| 4 | Créneaux | `apps/partner/app/(dashboard)/slots/page.tsx` |
| 5 | Créneaux · Bloquer (modal) | _(modal dans slots/page.tsx)_ |
| 6 | Réservations | `apps/partner/app/(dashboard)/reservations/page.tsx` |
| 7 | Live | `apps/partner/app/(dashboard)/live/page.tsx` |
| 8 | Avis clients | `apps/partner/app/(dashboard)/reviews/page.tsx` |
| 9 | Revenus & Finances | `apps/partner/app/(dashboard)/revenue/page.tsx` |
| 10 | Support | `apps/partner/app/(dashboard)/support/page.tsx` |
| 11 | Rôles & Accès | `apps/partner/app/(dashboard)/roles/page.tsx` |
| 12 | Rôles · Créer accès (modal) | _(modal dans roles/page.tsx)_ |

### Phase 5 — Mobile App (ordre des écrans)

Référence fichiers : `context/ui-registry.md` section "App Mobile"
Référence maquettes : `context/design/mockups/mobile/`

| Ordre | Section | Fichiers cibles |
|---|---|---|
| 1 | Auth (Splash + Login + OTP + Mode) | `apps/mobile/app/(auth)/` |
| 2 | Terrains → Créneau → Paiement → Confirm | `apps/mobile/app/terrains/` |
| 3 | Leagues → Détail → Classement → Calendrier | `apps/mobile/app/(tabs)/leagues/` |
| 4 | Score Live | `apps/mobile/app/match/[id]/` |
| 5 | Communauté → Post → Détail | `apps/mobile/app/(tabs)/community/` |
| 6 | Profil → Réservations → Paramètres | `apps/mobile/app/(tabs)/profile/` |
| 7 | Notifications | `apps/mobile/app/notifications/` |
| 8 | Inscription league | `apps/mobile/app/leagues/[id]/join-confirm.tsx` |

---

## 7. RÈGLES DE CODE

### Backend NestJS

```typescript
// DTO — toujours valider avec class-validator
export class CreateLeagueDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsEnum(LeagueLevel)
  level: LeagueLevel;

  @IsInt()
  @Min(4)
  @Max(16)
  maxTeams: number;
}

// Service — toujours utiliser Prisma, jamais de raw SQL
async findMatchesOfDay(): Promise<Match[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return this.prisma.match.findMany({
    where: {
      scheduledAt: { gte: today },
      status: { notIn: ['CANCELLED', 'POSTPONED'] },
    },
    include: { homeTeam: true, awayTeam: true, terrain: true },
  });
}

// Guard — rôle requis sur les routes sensibles
@UseGuards(JwtGuard, RoleGuard)
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
@Delete(':id')
remove(@Param('id') id: string) { ... }
```

### Frontend Next.js (Admin BO + Partner)

```typescript
// Composant serveur par défaut — data fetching direct
export default async function LeaguesPage() {
  const leagues = await fetchLeagues(); // appel API côté serveur
  return <LeaguesList initialData={leagues} />;
}

// Client component — uniquement pour l'interactivité
'use client';
export function LeagueDrawer({ leagueId }: { leagueId: string }) {
  const { data } = useQuery({ queryKey: ['league', leagueId], queryFn: ... });
  // ...
}

// Couleurs — toujours via les classes Tailwind configurées
// ✅ bg-primary text-white
// ❌ style={{ backgroundColor: '#1E7A3A' }}
```

### Mobile React Native

```typescript
// NativeWind — classes Tailwind dans className
<Pressable
  className="bg-accent rounded-xl py-3 px-6 active:opacity-80"
  onPress={handlePay}
>
  <Text className="text-white font-semibold text-base">Payer</Text>
</Pressable>

// Zustand store
interface AuthStore {
  user: User | null;
  mode: UserMode;
  setUser: (user: User) => void;
  setMode: (mode: UserMode) => void;
}
```

### Prisma Schema — conventions

```prisma
model League {
  id        String        @id @default(cuid())
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  status    LeagueStatus  @default(DRAFT)
  // ...
}

enum LeagueStatus {
  DRAFT
  REGISTRATIONS_OPEN
  REGISTRATIONS_CLOSED
  IN_PROGRESS
  SUSPENDED
  FINISHED
  ARCHIVED
}
```

---

## 8. LOGIQUE MÉTIER CRITIQUE (résumé — lire business-rules.md pour le complet)

### Statuts des entités

| Entité | Statuts |
|---|---|
| League | BROUILLON → INSCRIPTIONS_OUVERTES → INSCRIPTIONS_CLOSES → EN_COURS → SUSPENDUE → TERMINÉE → ARCHIVÉE |
| Match | PROGRAMMÉ → PUBLIÉ → CONFIRMÉ → EN_COURS → MI_TEMPS → TERMINÉ → VALIDÉ + SUSPENDU · REPORTÉ · ANNULÉ |
| Résultat | BROUILLON → SOUMIS → VALIDÉ → CONTESTÉ → CORRIGÉ |
| Composition | BROUILLON → SOUMIS → VERROUILLÉ |
| Slot/Créneau | DISPONIBLE → RÉSERVÉ → EN_ATTENTE → BLOQUÉ |

### Règles critiques à implémenter

- **1 joueur = 1 équipe par league** (contrainte DB unique)
- **Terrain domicile obligatoire** à la création d'une équipe (FK vers terrain partenaire)
- **Composition deadline J-24h** : après la deadline → champ `composition.isLocked = true`
- **Forfait auto** : si composition non soumise à J-0 → résultat 3-0 pour l'adversaire
- **Auto-suspension** : 3ème carton jaune → 1 match auto · carton rouge → 1+ match
- **Commission** : paiement réservation terrain = brut × 0.10 → GBONHI FOOT
- **Réservation confirmée** uniquement après webhook paiement CinetPay
- **Sync créneaux Realtime** : blocage partenaire → Supabase Realtime → mobile immédiat
- **Standings auto** : trigger SQL sur INSERT match_event recalcule la table de classement

### Match Journey Admin (séquence non contournable)

```
Matchs du jour → Détail match → Identification Contrôleur → Saisie Live
```

Chaque étape doit valider la précédente avant d'avancer.

### Séquence boutons Live (ordre strict)

```
[Démarrer] → [Mi-temps] → [Reprendre] → [Temps add.] → [Terminer]
```

Boutons transversaux disponibles à tout moment : [Suspendre] [Signaler incident]

---

## 9. RÈGLES SUPABASE RLS

Chaque table doit avoir des politiques RLS. Exemples types :

```sql
-- Lectures publiques pour les données communes
CREATE POLICY "leagues_read_public" ON leagues
  FOR SELECT USING (status != 'DRAFT');

-- Écriture réservée aux admins via JWT claim
CREATE POLICY "leagues_write_admin" ON leagues
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text
    IN ('SUPER_ADMIN', 'ADMIN')
  );

-- Partner voit uniquement son terrain
CREATE POLICY "terrains_partner_own" ON terrains
  FOR ALL USING (partner_id = auth.uid());
```

---

## 10. VARIABLES D'ENVIRONNEMENT

### backend/.env
```env
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
CINETPAY_API_KEY=...
CINETPAY_SITE_ID=...
EXPO_PUSH_BASE_URL=https://exp.host/--/api/v2/push/send
```

### apps/admin/.env.local
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### apps/partner/.env.local
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### apps/mobile/.env
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_URL=http://localhost:3001
```

---

## 11. STRUCTURE DES COMPOSANTS ADMIN BO

Tout composant créé dans `apps/admin/components/` doit être enregistré dans `context/ui-registry.md`.

```
apps/admin/components/
├── layout/
│   ├── Sidebar.tsx              ← fond #1E7A3A + motifs ivoiriens 8%
│   ├── TopBar.tsx               ← breadcrumb + avatar + badge rôle
│   └── DashboardLayout.tsx
├── ui/
│   ├── KpiCard.tsx              ← métrique + delta + PeriodFilterChips
│   ├── PeriodFilterChips.tsx    ← Aujourd'hui · 7j · 30j · Mois · Période
│   ├── DataTable.tsx            ← @tanstack/react-table + shadcn
│   ├── StatusBadge.tsx          ← badge coloré par statut
│   ├── ContextMenu3Points.tsx   ← dropdown ··· actions
│   ├── LeagueDrawer.tsx         ← 6 onglets ligue
│   ├── MatchJourneyBreadcrumb.tsx
│   ├── LiveControlBand.tsx      ← score + séquence boutons Live
│   ├── LiveEventModal.tsx       ← saisie but/carton/remplacement
│   ├── CompositionDrawer.tsx    ← 11 titulaires + remplaçants
│   ├── PlayerSlideOver.tsx      ← fiche joueur complète
│   └── PermissionsMatrix.tsx    ← 5 rôles × 19 modules
└── charts/
    ├── RevenueChart.tsx
    ├── DonutChart.tsx
    └── SparklineChart.tsx
```

---

## 12. STRUCTURE DES COMPOSANTS PARTNER PORTAL

```
apps/partner/components/
├── layout/
│   ├── Sidebar.tsx              ← fond #1A3D2B + motifs ivoiriens 8%
│   ├── TopBar.tsx
│   └── DashboardLayout.tsx
├── ui/
│   ├── KpiCard.tsx
│   ├── PeriodFilterChips.tsx    ← même composant que admin (partager via packages/)
│   ├── TerrainDuJourBanner.tsx  ← fond #F0FDF4 · bordure #A7F3D0 · 4 métriques
│   ├── SlotCalendar.tsx         ← calendrier semaine/jour créneaux colorés
│   ├── BlockSlotModal.tsx       ← blocage créneau + bandeau sync mobile #EFF6FF
│   ├── ReservationTable.tsx
│   ├── LiveTimeline.tsx
│   ├── ReviewCard.tsx
│   └── TransactionRow.tsx       ← brut · commission 10% · net reversé
└── charts/
    └── DailyRevenueChart.tsx
```

---

## 13. TYPES PARTAGÉS

Créer dans `packages/types/src/` puis exporter via `index.ts` :

```
user.ts          → User, PlayerProfile, UserMode
team.ts          → Team, TeamMember
league.ts        → League, LeagueStatus (7), LeagueStanding
match.ts         → Match, MatchEvent, MatchStatus (10), MatchEventType
composition.ts   → Composition, CompositionPlayer, CompositionStatus
result.ts        → MatchResult, ResultStatus (5), Scorer, Card
controller.ts    → Controller, ControllerIdentification
terrain.ts       → Terrain, Slot, SlotStatus, TerrainTariff, TerrainHoraire
reservation.ts   → Reservation, ReservationStatus
payment.ts       → Payment, PaymentProvider, PaymentAttempt
partner.ts       → Partner, PartnerRole, PartnerRevenue
role.ts          → AdminRole (5), Permission, PermissionMatrix
incidents.ts     → Incident, IncidentType, Suspension
notification.ts  → Notification, NotificationCategory
post.ts          → Post, Comment, FootballReaction
```

---

## 14. CONVENTIONS COMMITS ET PRs

```
feat(backend): add compositions module with J-24h deadline logic
feat(admin): implement match live control band component
feat(partner): add block slot modal with realtime sync
feat(mobile): add terrain booking flow
fix(backend): correct auto-suspension trigger on 3rd yellow card
fix(admin): period filter chip label (Période not Personnalisé)
chore: update supabase types from schema
test: add compositions deadline unit tests
```

**Checklist PR :**
- [ ] Types stricts (aucun `any`)
- [ ] DTO validés (class-validator)
- [ ] RLS Supabase défini sur les nouvelles tables
- [ ] Variables d'env documentées
- [ ] `context/progress-tracker.md` mis à jour
- [ ] `context/ui-registry.md` mis à jour si nouveau composant
- [ ] Maquette de référence consultée (`context/design/mockups/`)

---

## 15. SKILLS DISPONIBLES DANS CETTE SESSION

### `/architect`
Analyser et planifier l'implémentation d'une feature complexe.
Sortie : décision architecture + plan d'implémentation étape par étape.
Utiliser avant toute nouvelle feature impliquant plusieurs modules.

### `/review`
Code review technique : sécurité, performance, standards du projet.
Vérifier : types stricts, RLS Supabase, validation DTO, no N+1 queries, couleurs officielles.

### `/imprint`
Mettre à jour `context/progress-tracker.md` avec les décisions prises dans cette session.
Appeler en fin de session longue ou après décision architecturale importante.

### `/recover`
Reconstruire le contexte depuis `context/progress-tracker.md` + `context/build-plan.md`.
Appeler en début de nouvelle session pour retrouver l'état exact du projet.

---

*AGENTS.md v2 — GBONHI FOOT — 2026-07-22*
