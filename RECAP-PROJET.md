# GBONHI FOOT — Récapitulatif projet

_Dernière mise à jour : 30 juillet 2026 (Phase 6 + alignement s22→s36 + splash animé + paramètres)_

Plateforme de football amateur ivoirien. Monorepo (Turborepo) : `apps/mobile` (React Native / Expo SDK 52), `apps/admin` (back-office Next.js 15), `apps/partner` (portail partenaire Next.js 15), `backend` (NestJS 11 + Fastify + Prisma 6), base **Supabase**.

---

## ✅ Ce qui est fait

### Authentification & accès
- Inscription email/téléphone avec blocage des doublons.
- Connexion par téléphone → code OTP (email), écran OTP avec **renvoi du code fonctionnel** (minuteur visible, gestion d'erreur) et **bouton retour** sûr.
- Flux post-connexion + gating de la fiche joueur (obligatoire avant d'accéder aux Ligues).

### Application mobile
- Accueil 100 % branché sur le compte connecté (équipes, matchs, ligues, stats).
- Système de design réutilisable : fond filigrane kente + header vert (propagé à ~25 écrans).
- Écran 8 (accueil) reproduit sur maquette + barre de navigation.
- **Section Ligues** : liste + détail avec vraies données (image, statut, dates, inscrits, dotation, règlement, récompenses, format).
- Inscription d'une équipe à une ligue (flux complet).

### Section Équipe (finalisée cette session)
- **Créer une équipe** : upload logo, **palette de couleurs étendue** (principale + secondaire + couleur personnalisée), choix du terrain domicile.
- **Rejoindre une équipe** par code, et par **lien d'invitation** (deep link `gbonhi://join?code=…`).
- **Écran « Mon équipe »** dynamique : effectif réel, code/lien d'invitation, et **validation des demandes par le capitaine** (accepter / refuser). Bandeau « demande en attente » côté joueur.
- Points d'accès ajoutés (Profil → Mon équipe, et depuis l'inscription en ligue).

### Back-office (admin)
- KPI (tous les sous-onglets, vraies données), Finance, Matchs (contrôleur + déroulement), Équipes (détails/résultats/calendrier), Terrains (upload multi-images), Calendrier (contrôleur, génération, publication).
- Configuration complète des ligues (niveau, frais, format, règlement, récompenses, bannière) + machine à états des statuts.

### Communauté
- Feed communautaire (backend + mobile).

### Phase 6 — Notifications ✅
- Backend : `NotificationsService.notify()` crée la notification en base **et** envoie le push Expo (best-effort, ne casse jamais l'action métier). Endpoints : enregistrement du token, liste, compteur non-lus, tout marquer lu, marquer lu.
- Déclencheurs branchés sur 4 domaines :
  - **Équipe** : demande reçue (→ capitaine), acceptée / refusée (→ joueur).
  - **Matchs** : match programmé, résultat validé (avec le score).
  - **Ligues** : inscription enregistrée ; inscriptions ouvertes / ligue démarrée / terminée.
  - **Communauté** : j'aime et commentaire (→ auteur du post).
- Mobile : enregistrement auto du token au login (défensif), écran **Notifications** (liste, icônes par type, non-lus, « Tout lire », pull-to-refresh, navigation contextuelle), cloche accueil + badge non-lus.
- ⚠️ Le push **système** (hors app) nécessite un vrai `eas.projectId` dans `app.json` (actuellement `YOUR_EAS_PROJECT_ID`) + appareil physique. Le reste (in-app) fonctionne déjà.

### Phase 6 — Support & Incidents ✅
- Backend : table `support_tickets` (migration), module `support` (SQL brut). Créer un ticket (user), lister / filtrer / répondre (admin). Une réponse ou un changement de statut notifie automatiquement l'auteur.
- Back-office : pages **Support** et **Incidents** fonctionnelles — filtres par statut avec compteurs, tableau trié (ouverts + critiques en tête), panneau de détail pour répondre et changer statut/priorité.
- Mobile : écran **Aide & Support** (Profil → « Aide & Support ») — créer un ticket (catégorie, sujet, message) + liste de mes demandes avec statut et réponse du support.

### Alignement maquettes mobile s22 → s36 ✅
Parcours complet aligné écran par écran sur les maquettes (`context/design/mockups/mobile/exports`) :
- **s22 Liste terrains** : header kente, carte cliquable sans boutons, badge dispo, badge type coloré, chips (surfaces + formats).
- **s23 Détail terrain** : hero carousel, équipements en chips à icônes, carte tarif, **créneaux du jour** (vraie dispo), CTA Réserver.
- **s24 Sélection créneau** : header kente, sélecteur de jours, grille horaires 3 colonnes (Disponible/Sélectionné/Occupé), « Continuer ».
- **s25 Récap** : carte terrain + détails + **modes de paiement** (Wave, Orange Money, MTN MoMo, Carte — logos réels), bouton « Payer X FCFA ».
- **s26 Confirmation** : check vert, N° `#GB-AAAA-XXXX`, « Télécharger le reçu » (partage), « Retour à l'accueil ».
- **s27 Feed communauté** : header kente centré, chips (Tout/Mon équipe/Leagues/Terrains), cartes (badge OFFICIEL, avatar, réactions).
- **Multi-réactions** (backend) : ⚽ 🔥 👏 💪 avec compteurs par type — migration + endpoint `POST /community/posts/:id/react` ; affiché en feed et détail.
- **s28 Créer un post** : header croix, auteur, **upload photo** (bucket `community`), tag équipe, Publier + **Partager sur WhatsApp** (vrai logo).
- **s29 Détail post** : header ⋯, **Signaler** (crée un ticket incident), réactions en pilules, « Commentaires · N », **Inviter via WhatsApp**, champ commentaire.
- **s30 Profil Leagues** : header riche (avatar, poste, badge mode), 4 stats réelles (Matchs/Buts/Passes/Tournois), Mon équipe, Modifier fiche, Accomplissements (dérivés des stats), onglets Activité/Équipes/Historique.
- **s31 Profil Réservation** : 2 stats (Réservations / Terrains favoris), onglets À venir/Passées/Favoris avec vraies réservations (`/reservations/mine`).
- **s32 Paramètres** (nouvel écran `/settings`) : Compte (profil, numéro, notifications), Application (mode, langue, à propos, CGU), Zone de danger (déconnexion, **suppression de compte** via ticket).
- **s33 Notifications** : chips (Tout/Matchs/Réservations/Communauté), regroupement AUJOURD'HUI/CETTE SEMAINE, tuiles d'icônes colorées, point de non-lu.
- **s34/35/36 Équipe** : déjà alignés (Mon équipe, Créer, Rejoindre).

**Bug latent corrigé au passage** : `CreateReservationDto` et `RegisterTeamDto` validaient un ID seed avec `@IsUUID()` (variante RFC non conforme) → **réservation/inscription auraient échoué** → passés en `@IsString()`.

### Écran d'ouverture (splash) animé ✅
- Le splash (`app/index.tsx` → `(auth)/splash.tsx`) est désormais **réellement l'écran d'entrée** de l'app (l'`AuthGate` ne le court-circuite plus ; il gère lui-même la navigation à la fin de l'intro).
- Fond **identique à la maquette s01** (`splash-bg.png` : kente + écusson + halo), avec en plus une **ouverture cinématique** : voile qui se lève + léger zoom, **halo radial doré vectoriel** qui « respire », **but + filet**, **rond central de terrain** qui se dessine, **ballon à pentagones** qui roule et rebondit, puis fondu → image finale identique. **Interactif** : « Touche pour continuer ».
- Dépendance ajoutée : **`react-native-svg` 15.8.0** (graphismes vectoriels du splash). ⚠️ Module natif → nécessite `npx expo install react-native-svg` + rebuild (`npx expo run:ios`). Installé et compilé ✅.
- Renforcement des **Paramètres** : Changer de numéro (modal → `user_metadata.phone`), Notifications (persisté), Langue (persisté), Conditions d'utilisation (texte réel), suppression de compte (ticket).

---

## 🩹 Corrections de connexion (session précédente)
Une série de blocages « Network request failed / rien ne s'affiche » a été résolue :
1. **Mauvaise commande backend** : le script est `npm run dev` (et non `start:dev`).
2. **IP figée** : l'URL du backend est désormais **détectée automatiquement** depuis l'hôte Metro → marche sur simulateur ET iPhone physique sans rien changer.
3. **Validation trop stricte** (`@IsUUID`) qui rejetait l'UUID du terrain seed → passée en `@IsString`.
4. **Contrainte DB** `team_members_role_check` qui refusait le rôle `captain` → valeur ajoutée.
5. Upload logo fiabilisé (ArrayBuffer + message d'erreur réel).

---

## ⏳ Phases restantes

### Paiement (CinetPay)
- Inscription payante en ligue (s19/s20) + paiement des réservations (s25) — **en attente des clés API CinetPay**. L'UI de sélection du mode de paiement est déjà en place (Wave, Orange Money, MTN, Carte).

### Configuration push production
- Renseigner un vrai `eas.projectId` dans `apps/mobile/app.json` pour activer le push OS (hors app), et tester sur appareil physique.

### Améliorations différées (données/endpoints manquants)
- **Notifications de réservation** (confirmation/annulation par le partenaire) : à émettre côté backend → alimentera le filtre « Réservations ».
- **Flux d'activité du profil** (buts/passes récents) : nécessite un endpoint d'événements du joueur.
- **Tag « Ligue »** sur un post communautaire : nécessite une colonne `league_id` sur les posts.
- **Rôle de l'auteur** dans les posts (badge « Capitaine ») : à renvoyer dans l'API communauté.
- **Vraies photos non carrées** à la création de post : ajouter `expo-image-manipulator` (rebuild natif) pour redimensionner sans recadrer.
- **Système de favoris** de terrains : actuellement dérivé des terrains réservés.
- **Changer de numéro / Langue / CGU** dans les Paramètres : écrans à implémenter.

### Divers / dette technique
- UUIDs seed non conformes RFC (`1111…`, `2222…`) : contournés via validation souple (`@IsString`). Tous les DTO exposés à des IDs seed ont été corrigés.
- `support_tickets` et `post_reactions` (multi-type) : logique en SQL brut (pas de `prisma generate`). Si besoin de typage Prisma, aligner `schema.prisma` + régénérer.
- Buckets Storage créés : `leagues`, `teams`, `terrains`, `community`.

---

## 🔧 Rappels techniques
- **Lancer le backend** : `cd backend && npm run dev` (port 3001, écoute `0.0.0.0`).
- **Lancer le mobile** : `cd apps/mobile && npx expo start --clear` puis `i`.
- Vérifier l'URL API dans les logs Metro : `[api] API_BASE = …`.
- iPhone physique : Mac + téléphone sur le **même Wi-Fi**.
- **Point d'entrée de l'app** : `app/index.tsx` (splash animé). Toute nouvelle dépendance **native** (ex. `react-native-svg`) impose `npx expo install <pkg>` **puis** `npx expo run:ios` (un simple reload JS ne suffit pas → écran rouge « module not found » / crash natif).
