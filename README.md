# GBONHI FOOT

**L'esprit communautaire, l'identité ivoirienne**

Plateforme football communautaire pour la Côte d'Ivoire — Ligues, équipes, scores en direct, réservation de terrains, communauté.

---

## Applications

| App | Technologie | Hébergement | Audience |
|---|---|---|---|
| Mobile | React Native + Expo SDK 52 | App Store / Play Store | Joueurs, fans |
| Admin BO | Next.js 15 + shadcn/ui | Render Starter $7/mo | Administrateurs |
| Partner Portal | Next.js 15 + shadcn/ui | Render Starter $7/mo | Propriétaires terrains |
| API | NestJS 11 + Fastify + Prisma 6 | Render Standard $25/mo | Backend commun |

**Infra totale : ~$74/mo (≈ 48,000 FCFA)**

---

## Stack

```
React Native + Expo      ← Mobile (iOS + Android)
Next.js 15 + shadcn/ui  ← Admin BO + Partner Portal
NestJS 11 + Fastify     ← API REST
Prisma 6                 ← ORM
Supabase Pro             ← PostgreSQL + Auth + Storage + Realtime
CinetPay                 ← Paiements (Wave, Orange Money, MTN, Visa)
Expo Push                ← Notifications push
Turborepo                ← Monorepo
```

---

## Structure

```
gbonhi-foot/
├── apps/
│   ├── mobile/          # React Native + Expo
│   ├── admin/           # Next.js 15 (Back-Office Admin)
│   └── partner/         # Next.js 15 (Portail Partenaire)
├── backend/             # NestJS 11 API
├── packages/
│   └── types/           # Types TypeScript partagés
├── supabase/
│   └── migrations/      # 7 migrations SQL
├── context/             # Fichiers de contexte AI (lire avant de coder)
│   └── design/          # Maquettes + prompts Claude Design
├── AGENTS.md            # Instructions pour les agents AI
└── memory.md            # Mémoire cross-sessions
```

---

## Démarrage rapide

### 1. Variables d'environnement

```bash
cp .env.example .env
# Remplir : DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, CINETPAY_*
```

### 2. Backend NestJS

```bash
cd backend && npm install
npm run db:generate    # Prisma client
npm run dev            # → http://localhost:8000 | Swagger: /docs
```

### 3. Admin BO

```bash
cd apps/admin && npm install && npm run dev   # → http://localhost:3001
```

### 4. Partner Portal

```bash
cd apps/partner && npm install && npm run dev  # → http://localhost:3002
```

### 5. Mobile

```bash
cd apps/mobile && npm install && npx expo start
```

### 6. Tout en parallèle (Turborepo)

```bash
npm install && npm run dev
```

---

## Workflow AI-assisted

Lire les fichiers `context/` dans l'ordre défini dans `AGENTS.md` avant toute implémentation.

---

## Brand

| Couleur | Hex | Usage |
|---|---|---|
| Vert ivoirien | `#1E7A3A` | Couleur principale |
| Orange passion | `#F7921E` | Accent, CTA |
| Vert foncé | `#155A2C` | Sidebar dark |

**Valeurs** : Communauté · Unité · Compétition · Passion · **Deadline : Août 2026**
