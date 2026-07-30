# Memory — Gbonhi Foot

Dernière mise à jour : 2026-07-08

---

## État du projet

**Phase actuelle :** Phase 1 — Fondation (démarrage)
**Deadline :** Août 2026 (7 semaines restantes)
**Budget :** 2,000,000 FCFA — 4 paiements de 500,000 FCFA

---

## Décisions techniques actées

| Décision | Choix | Raison | Date |
|---|---|---|---|
| Mobile | React Native + Expo SDK 52 | Cohérence TypeScript, spec du projet | 2026-07-08 |
| Routing mobile | Expo Router v4 | File-based routing, natif Expo | 2026-07-08 |
| Backend | NestJS 11 + Fastify | Spec du projet, TypeScript, perf | 2026-07-08 |
| Auth | Supabase Auth (OTP + Google OAuth) | Simplifie à 2 vendors | 2026-07-08 |
| Storage | Supabase Storage | Inclus Pro, évite Cloudflare R2 | 2026-07-08 |
| Push notifs | Expo Push Notifications | Pas besoin de Firebase du tout | 2026-07-08 |
| Hébergement | Render only (pas Vercel) | Centralisation, dashboard unique | 2026-07-08 |
| Monorepo | Turborepo | Types partagés, CI/CD unifié | 2026-07-08 |
| ORM | Prisma 6 | Type-safe, migrations | 2026-07-08 |
| Paiements | CinetPay | Wave/OM/MTN CI, integration locale | 2026-07-08 |

---

## Architecture infrastructure

```
Render Standard $25/mo    ← NestJS API (backend/)
Render Free      $0/mo    ← Admin BO (apps/admin/)
Render Free      $0/mo    ← Partner Portal (apps/partner/)
Supabase Pro    $25/mo    ← PostgreSQL + Auth + Storage + Realtime
CinetPay        %comm     ← Paiements
─────────────────────────
Total           $50/mo    ← ≈ 32,000 FCFA

Redis retiré (pas de cache externe pour le MVP).
Rate limiting en mémoire via @nestjs/throttler.
```

---

## Règles métier critiques

1. **Un User peut créer et appartenir à une seule team dans une seule league**
2. La réservation n'est confirmée qu'après callback CinetPay (webhook)
3. Les scores sont mis à jour par trigger SQL (pas côté API)
4. Un terrain appartient à un seul Partner
5. Les admins n'ont pas accès aux données financières des partenaires (RLS)

---

## Structure workspace

```
gbonhi-foot/ (Turborepo monorepo)
├── apps/mobile/      ← RN + Expo
├── apps/admin/       ← Next.js 15
├── apps/partner/     ← Next.js 15
├── backend/          ← NestJS 11
├── packages/types/   ← Types TS partagés
├── supabase/migrations/  ← 7 migrations SQL (001-007)
└── context/design/   ← Maquettes + 15 prompts Claude Design
```

---

## Prochaines étapes (session suivante)

1. **Générer les maquettes** avec Claude Design en utilisant les prompts dans `context/design/prompts/`
2. **Présenter aux fondateurs** pour validation
3. **Après validation** → commencer Phase 1 :
   - Setup NestJS (F01-F05)
   - Setup Expo mobile (F06-F11)
   - Setup Next.js admin + partner (F12-F17)

---

## Notes importantes

- Les migrations Supabase 001-005 sont valides (profiles, teams, tournaments, matches, community)
- Ajouter migrations 006 (terrains) et 007 (réservations) avant de démarrer la Phase 4
- Installer `supabase-js` sur mobile avec `expo-secure-store` pour la persistence des sessions
- Pour CinetPay webhook : URL doit être accessible publiquement (pas localhost)
