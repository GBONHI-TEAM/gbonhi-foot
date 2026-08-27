# QA – GBONHI FOOT — Session du 26/08/2026

Checklist de test manuel sur téléphone, couvrant toutes les modifications de la session.
Coche `[x]` quand un point est validé. Note tout écart dans « Observations ».

> **Prérequis avant de tester**
> - Backend **redéployé sur Render** (dernier commit poussé). Vérifier l'API « Live ».
> - Build mobile **incluant `expo-clipboard`** (nouvelle dépendance native).
> - Variables d'env API : `ANDROID_PLAY_STORE_URL`, `MOBILE_APP_DOWNLOAD_URL` (TestFlight), `IOS_APP_STORE_URL` (quand publié).
> - Idéalement 2 comptes de test (dont un capitaine d'équipe) et 1 compte admin (back-office) pour les notifs.

---

## 1. Inscription / Connexion

- [ ] **1.1 E-mail facultatif** — Écran S'inscrire : le champ e-mail affiche **« Adresse e-mail (facultatif) »**, sans astérisque.
- [ ] **1.2 Popup champs requis** — Valider sans rien remplir → la popup dit **« Renseigne prénom, nom et téléphone. »** (l'e-mail n'est PAS mentionné).
- [ ] **1.3 E-mail vide (temporaire)** — Remplir prénom/nom/téléphone, laisser e-mail vide, valider → message « E-mail temporairement nécessaire… » (car OTP par e-mail tant que le SMS Orange n'est pas intégré).
- [ ] **1.4 Attribution image** — Écran d'accueil (Se connecter / S'inscrire) : **plus aucun texte « Photo by … Unsplash »** en bas ; « En continuant, tu acceptes… » toujours présent.
- [ ] **1.5 Auto-remplissage OTP** — À la réception du code, l'auto-remplissage iOS remplit **à partir de la 1re case** (plus au milieu). La saisie manuelle chiffre par chiffre marche aussi (avance + retour arrière).

### Vérification du numéro (comptes Apple / Google)
- [ ] **1.6 Gate OAuth** — S'inscrire/连 via **Google ou Apple** → on est redirigé vers l'écran **« Vérifie ton numéro »** (pas directement à l'accueil).
- [ ] **1.7 Envoi + saisie** — Saisir le numéro (+225) → « Envoyer le code » → code reçu **par e-mail** → saisir sur l'écran OTP → accès débloqué.
- [ ] **1.8 Numéro déjà utilisé** — Saisir un numéro déjà associé à un autre compte → message « Numéro déjà utilisé ».
- [ ] **1.9 Comptes e-mail non impactés** — Un compte créé par e-mail (qui a déjà un numéro) n'est PAS redirigé vers « Vérifie ton numéro ».

---

## 2. Clavier (général, tous formulaires)

- [ ] **2.1 Fermeture au scroll** — Sur « Ta fiche joueur », « Modifier le profil », inscription, communauté, etc. : quand le clavier est ouvert, **faire défiler vers le bas ferme le clavier**.
- [ ] **2.2 Barre « Terminé »** — Sur les champs numériques (Taille, Poids, Date, Téléphone), une **barre « Terminé »** apparaît au-dessus du clavier et le ferme (iOS).
- [ ] **2.3 Tap pour fermer** — Taper dans une zone vide ferme le clavier.

---

## 3. Fiche joueur & Profil

- [ ] **3.1 Flèche retour** — « Ta fiche joueur » (en édition depuis le profil) affiche une **flèche de retour** en haut à gauche.
- [ ] **3.2 Astérisque date** — Le champ date affiche **« jj/mm/aaaa * »** (obligatoire).
- [ ] **3.3 Retour au Profil** — Modifier la fiche depuis le Profil puis Enregistrer → on **revient au Profil** (pas à l'Accueil).
- [ ] **3.4 Photo de profil (compte)** — « Modifier le profil » : cliquer l'avatar (📷) → choisir une photo → « Enregistrer » → l'avatar s'affiche (communauté, équipe…).
- [ ] **3.5 Nom synchronisé** — Changer le nom dans « Modifier le profil », publier un post → le post affiche le **nouveau nom** (plus l'ancien nom Google).
- [ ] **3.6 Poste synchronisé** — Le poste choisi dans la fiche (ex. Défenseur central) apparaît dans l'effectif de l'équipe (voir 6.1).

---

## 4. Réservation de terrain (panier multi)

- [ ] **4.1 Ajout + toast** — Choisir terrain → créneau → Récapitulatif → « Ajouter au panier » → **toast « ✅ Ajouté au panier »** puis redirection vers le panier.
- [ ] **4.2 Panier multiple** — Ajouter **plusieurs réservations** → toutes apparaissent en **liste** (chacune sa carte).
- [ ] **4.3 Flèche retour** — L'écran « Mon panier » a une **flèche de retour**.
- [ ] **4.4 Badge** — Le badge de l'onglet Panier affiche le **nombre** de réservations en attente.
- [ ] **4.5 Actions par carte** — Chaque carte : **Modifier / Annuler / Valider** fonctionnent indépendamment (minuteur par carte).
- [ ] **4.6 Moyen de paiement** — Sélecteur Espèces / Wave / Orange / MTN / Moov avec **logos** ; choisir **Espèces** pour tester.
- [ ] **4.7 Validation** — Valider une réservation → confirmation + le reste du panier est conservé.
- [ ] **4.8 Plus de blocage** — On peut ajouter une 2e réservation **sans** le message « Tu as déjà une réservation en attente ».

### Reçu de réservation (PDF)
- [ ] **4.9 Détail réservation** — Profil → réservation confirmée → « Détail » : bouton **« Télécharger / partager le reçu »** (visible si confirmée + paiement validé).
- [ ] **4.10 Contenu du reçu** — Le PDF affiche : **motif ivoirien** sur tout le header + **logo GBONHI**, titre **« REÇU DE RÉSERVATION »** (accents), **« MONTANT PAYÉ »**, **Paiement : Espèces** (ou le moyen choisi), slogan **« Le football amateur commence ici ! »**.
- [ ] **4.11 Mois** — Le badge date affiche **AOÛT** (et non « AOÛ ») ; vérifier d'autres mois si possible.

---

## 5. Communauté

- [ ] **5.1 Barre de filtres** — Les onglets (Tout / Mon équipe / Leagues / Terrains) ne sont **pas rognés** et les publications ne rentrent pas dedans.
- [ ] **5.2 Avatar auteur** — Écran « Nouveau post » : l'avatar de l'auteur (photo) s'affiche (plus seulement les initiales).
- [ ] **5.3 Catégorie de publication** — « Publier dans » : choisir Général / Mon équipe / Leagues / Terrains.
- [ ] **5.4 Filtrage** — Un post publié en « Leagues » apparaît sous **Leagues** (et Tout), pas ailleurs. Un post « Général » n'apparaît que sous **Tout**.
- [ ] **5.5 Commentaire — retour visuel** — Envoyer un commentaire → le clavier se ferme et l'écran **descend jusqu'au commentaire ajouté** (plus de doute → plus de doublons).
- [ ] **5.6 Partage publication** — Bouton **« Partager la publication »** (menu natif : WhatsApp, SMS…), plus « Inviter via WhatsApp ».

---

## 6. Équipe

- [ ] **6.1 Effectif + poste** — « Mon équipe » : chaque membre affiche son **poste** sous le nom, en plus du badge (Capitaine / Joueur).
- [ ] **6.2 Inviter des joueurs** — Carte d'invitation : titre **« Inviter des joueurs »** centré, un seul bouton **« Partager le lien »**.
- [ ] **6.3 Copier le code** — **Maintenir le code** → « ✓ Code copié ! » (nécessite le build avec expo-clipboard).
- [ ] **6.4 Message d'invitation** — Le message partagé a le **lien** et le **code** sur des lignes séparées + la phrase « En cas de soucis avec le lien, ouvre l'app GBONHI FOOT… ».
- [ ] **6.5 Nommer capitaine** — En tant que capitaine : bouton **👑 Nommer** sur un membre → confirmation → il devient capitaine, tu redeviens membre (le nouveau capitaine reçoit une notif).

---

## 7. Suppression de compte

- [ ] **7.1 Suppression simple** — Compte joueur sans responsabilité → Paramètres → « Supprimer mon compte » → **suppression définitive** (déconnexion + compte effacé).
- [ ] **7.2 Blocage capitanat** — Capitaine d'une équipe avec d'autres membres → la suppression est bloquée avec CTA **« Gérer mon équipe »** → transférer le capitanat (👑 Nommer) → puis la suppression passe.
- [ ] **7.3 Admin/partenaire** — Un compte admin/partenaire peut se supprimer (après avoir transféré terrains/ligues le cas échéant).

---

## 8. Ligues

- [ ] **8.1 Logo d'équipe** — Écran « Inscription en league » : la carte « Équipe inscrite » affiche le **logo** de l'équipe (plus le carré de couleur).
- [ ] **8.2 Moyen de paiement** — Sélecteur Espèces / Wave / Orange / MTN / Moov avec **logos** ; choisir **Espèces** pour tester l'inscription.
- [ ] **8.3 Inscription** — Valider → « Inscription confirmée ».
- [ ] **8.4 Reçu ligue (PDF)** — Header **motif + logo**, titre **« REÇU D'INSCRIPTION LIGUE »**, **« MONTANT RÉGLÉ »**, **Paiement : Espèces**, « …inscription en **ligue** », slogan « Le football amateur commence ici ! ».

---

## 9. Matchs & Composition

- [ ] **9.1 Libellés** — Accueil : section **« Matchs du jour »** (avec « s ») ; barre d'onglets du bas : **« Ligues »** (plus « League »).
- [ ] **9.2 Détail match** — Ouvrir un match (« Voir le match ») → infos + faits de jeu + section **« Composition des équipes »**.
- [ ] **9.3 Compo non publiée** — Si aucune compo → **« Composition pas encore disponible »** (mention fenêtre ~2 h avant).
- [ ] **9.4 Publier (capitaine)** — En tant que capitaine d'une des 2 équipes : bouton **« Publier ma composition »** → choisir formation + marquer titulaires/remplaçants → Publier.
- [ ] **9.5 Affichage compo** — La compo publiée s'affiche (formation, titulaires, remplaçants) pour les deux équipes.

---

## 10. Notifications push

- [ ] **10.1 Envoi unique** — Depuis le back-office, envoyer une notification → elle arrive **une seule fois** sur le téléphone (plus en triple).
- [ ] **10.2 Bon compte** — Après reconnexion sur un autre compte sur le même téléphone, les notifications ne concernent que le **compte connecté**.

---

## 11. Page web smart-link (partage)

- [ ] **11.1 Rendu brandé** — Ouvrir un lien partagé (`/join?code=…` ou `/r/match/…`) dans le navigateur → page aux **couleurs GBONHI**, **logo** + **motif ivoirien** en fond.
- [ ] **11.2 Ouvrir l'app** — « Ouvrir dans l'application » ouvre l'app si installée ; sinon **redirige vers le store** selon l'OS (Play Store Android / TestFlight ou App Store iOS).

---

### Récapitulatif
| Section | Total | OK | KO |
|---|---|---|---|
| 1. Inscription/Connexion | 9 | | |
| 2. Clavier | 3 | | |
| 3. Fiche & Profil | 6 | | |
| 4. Réservation | 11 | | |
| 5. Communauté | 6 | | |
| 6. Équipe | 5 | | |
| 7. Suppression compte | 3 | | |
| 8. Ligues | 4 | | |
| 9. Matchs & Compo | 5 | | |
| 10. Notifications | 2 | | |
| 11. Smart-link | 2 | | |

**Observations / bugs à remonter :**
-
-
-
