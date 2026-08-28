# GBONHI FOOT — Récapitulatif de session (27/08/2026)

## ✅ Travail réalisé (code livré, commité)

### Authentification & comptes
- **Vérification du numéro obligatoire** pour les comptes Apple/Google (écran « Vérifie ton numéro » + OTP e-mail + gate).
- **E-mail facultatif** à l'inscription (placeholder « (facultatif) », popup sans e-mail).
- **OTP résilient** : le contexte est persisté → si l'app est fermée en arrière-plan (vieux Android) au moment d'aller chercher le code, elle rouvre l'écran de code au lieu de repartir en arrière.
- **Auto-remplissage OTP** : le code se remplit à partir de la 1re case.
- **Suppression de compte** définitive (données + Supabase Auth + stockage) ; autorisée pour admin/partenaire ; bloquée si terrains/ligues/capitanat, avec CTA « Gérer mon équipe ».
- **Photo de profil** ajoutée sur « Modifier le profil ».
- **Nom & poste synchronisés** vers la table profils (posts communauté et effectif à jour).

### Réservation
- **Panier multi-réservations** (liste, actions Modifier/Annuler/Valider par carte, badge, flèche retour, toast « Ajouté au panier »).
- **Moyens de paiement** (Espèces/Wave/Orange/MTN/Moov + logos) sur réservation ET inscription ligue.
- **Reçus PDF brandés** (réservation + ligue) : logo, motif ivoirien plein header, accents, moyen de paiement réel, slogan « Le football amateur commence ici ! ».
- **Reçu téléchargeable/partageable** depuis le détail réservation ; abréviations de mois corrigées (AOÛT).
- **Accueil** : réservations à venir rechargées à chaque retour (annulées exclues).

### Ligues & matchs
- **Composition d'équipe** : publication par le capitaine (formation, titulaires, remplaçants) + affichage dans le détail match (fallback « pas encore disponible »).
- **Logos d'équipe** affichés (inscription ligue, onglet Matchs de la ligue, onglet Match).
- **Effectif** : poste affiché sous le nom.
- Libellés : **« Matchs du jour »**, onglet/titre **« Ligues »**.

### Communauté
- **Catégories de publication** (Général / Mon équipe / Leagues / Terrains) + filtrage.
- Barre de filtres non rognée ; avatar de l'auteur dans « Nouveau post » ; retour visuel + scroll auto après un commentaire ; partage natif de publication.

### Équipe
- **Transfert de capitanat** (« 👑 Nommer ») + notification.
- Invitation : « Inviter des joueurs » centré, un seul bouton « Partager le lien », **code copiable** (long-press), message d'invitation avec lien + code détachés.
- **Deep-link d'invitation** prioritaire sur la sélection de mode (code pré-rempli, plus d'éjection).

### Notifications
- **Correctif push en triple** (déduplication des tokens + détachement du token des autres comptes + nettoyage base).
- Handler SDK 52 (affichage même app ouverte).
- Push déjà en place pour : demande d'adhésion, demande acceptée, réactions/commentaires.

### Divers
- **Page smart-link web** à la charte (logo + motif + couleurs) + redirection App Store/Play Store selon l'OS.
- Clavier : barre **« Terminé »** (champs numériques) + fermeture au scroll partout.
- Attribution « Unsplash » retirée de l'image de fond du login.
- Correctifs build : splash Android, cible API 35, `POST_NOTIFICATIONS`.

## ✅ Déjà appliqué en base (live, sans déploiement)
- Synchro `profiles.full_name` + `profiles.position` (triggers + rétro-sync) et contrainte de poste (libellés FR).
- Colonne `category` (posts) ; table `match_lineups`.
- Nettoyage des tokens push dupliqués et des réservations fantômes.

## ⚙️ Infrastructure
- **FCM Android configuré** (google-services.json committé + clé de service FCM V1 sur EAS) → push Android prêt.
- iOS : push APNs déjà géré par EAS.

---

## ⏳ Ce qu'il reste à faire

### Déploiement (à lancer)
1. **`git push origin main`** → attendre le redéploiement Render (l'API porte panier multi, compo, reçus, notifs, deep-link…).
2. **Build Android** : `eas build --platform android --profile production` → importer le `.aab` dans **Play Console → Test interne** → déployer.
3. **Build iOS** : `npx expo install expo-clipboard` → `eas build --platform ios --profile preview` (test perso QR) puis, une fois validé, `--profile production` + `eas submit` (TestFlight).
4. **TestFlight** : le lien public externe refuse de nouveaux testeurs → assigner un build au **groupe externe** + soumettre à la **revue bêta**, ou augmenter la limite de testeurs.

### Validation manuelle
5. **Tester avec le fichier QA** (`QA-TEST-GBONHI-FOOT-2026-08-26.md`) sur Android ET iOS après build.

### En attente de tiers
6. **SMS OTP via Orange** : en attente de validation du **Sender ID « GBONHI FOOT »** (mail de réponse préparé + captures/vidéo à joindre). En attendant, l'OTP passe par **e-mail**.
7. **Variables d'env store** (`IOS_APP_STORE_URL`, `ANDROID_PLAY_STORE_URL`) à renseigner sur Render une fois l'app publiée.

### Fonctionnalités différées (non commencées)
8. **Paiement Mobile Money réel** (CinetPay / Orange / Wave / MTN / Moov) — actuellement simulé (sauf Espèces).
9. **Publication publique** App Store + Google Play (production).
10. (Optionnel) Assistant d'onboarding partenaire (priorité 2, différé).

---

### Fichiers de référence
- `QA-TEST-GBONHI-FOOT-2026-08-26.md` — checklist de test manuel.
- `RECAP-SESSION-2026-08-27.md` — ce document.
