# Guide — Créer et gérer les comptes Contrôleur

Ce guide explique comment créer plusieurs comptes **Contrôleur** dans le back-office GBONHI Foot. Un contrôleur est la seule personne (avec le Super Admin) autorisée à **contrôler et saisir le score d'un match en direct** — et uniquement sur les matchs qui lui ont été **assignés**.

## Pourquoi plusieurs contrôleurs ?

L'assignation automatique des matchs d'une journée répartit les rencontres entre **tous** les comptes contrôleur, en évitant qu'un même contrôleur soit sur deux matchs à la même heure. Il faut donc **au moins autant de contrôleurs que de matchs joués en simultané** sur une journée. Avec un seul compte, les matchs à la même heure ne pourront pas tous être couverts.

Règle simple : compte le nombre maximum de matchs qui se jouent **en même temps** sur une journée, et prévois au moins ce nombre de contrôleurs.

## Créer un compte Contrôleur (pas à pas)

> Réservé au **Super Admin**.

1. Dans le back-office, ouvre le menu **Rôles & Accès** (barre latérale).
2. Clique sur **« Ajouter un membre »** (bouton orange, en haut à droite).
3. Renseigne :
   - **Nom complet** — le vrai nom du contrôleur (c'est ce nom, verrouillé au compte, qui apparaîtra comme contrôleur du match).
   - **E-mail** — l'adresse personnelle du contrôleur.
   - **Rôle** — choisis **« Contrôleur »**.
4. Clique sur **« Envoyer l'invitation »**.
5. Le contrôleur reçoit un e-mail :
   - **Nouveau compte** → il choisit son mot de passe depuis l'e-mail, puis se connecte au back-office.
   - **Compte déjà existant** (l'e-mail est déjà utilisé) → le rôle Contrôleur lui est attribué et un e-mail lui permet de définir son mot de passe d'accès au back-office.

Répète l'opération pour chaque contrôleur à créer.

## Vérifier la liste des contrôleurs

- La page **Rôles & Accès** liste tous les membres de l'équipe admin avec leur rôle.
- Dans **Calendriers**, le menu déroulant d'assignation d'un match ne propose **que** les comptes Contrôleur — si un contrôleur y apparaît, il est bien pris en compte.

## Assigner les contrôleurs aux matchs

Deux méthodes, combinables :

- **Automatique** (recommandé) : sur la page **Calendriers**, sélectionne la journée, puis clique sur **« ⚡ Assigner Jx »**. Les matchs sans contrôleur sont répartis équitablement entre tous les comptes contrôleur, sans conflit d'horaire. Un récapitulatif indique qui a été assigné et ce qui reste éventuellement à couvrir.
- **Manuelle** : sur chaque ligne de match, choisis le contrôleur dans le menu déroulant. Utile pour ajuster un cas précis. L'assignation automatique conserve les choix manuels déjà faits (sauf si tu utilises « Tout réassigner »).

## Ce que peut / ne peut pas faire un Contrôleur

- ✅ Contrôler et saisir le score en direct **des matchs qui lui sont assignés**.
- ✅ Accès en lecture aux ligues, calendriers et matchs.
- ❌ Aucun accès aux utilisateurs, terrains, finance, avis, ni à la gestion des rôles.
- ❌ Aucun accès au contrôle d'un match qui **ne lui est pas assigné** (refus automatique).

Le **Super Admin** conserve tous les droits sur tous les matchs, y compris la saisie du score.

## Rappel sécurité

L'identité du contrôleur affichée sur un match est **dérivée automatiquement de son compte connecté** — elle ne peut pas être saisie librement ni falsifiée. Les droits sont vérifiés côté serveur (API), pas seulement dans l'interface.
