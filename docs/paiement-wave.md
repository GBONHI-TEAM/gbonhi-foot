# Intégration paiement Wave (Checkout API)

Statut : **architecture en place, inactive tant que `WAVE_API_KEY` n'est pas défini.**
Aucun appel sortant n'est fait sans clé — comme pour Orange SMS.

Doc officielle : https://docs.wave.com/checkout — Base URL `https://api.wave.com`.

## Principe

Wave fonctionne en **checkout hébergé** : on crée une session côté serveur, on
renvoie une URL (`wave_launch_url`) que **l'utilisateur ouvre dans son navigateur**
(jamais en webview — sinon le rebond vers l'app Wave échoue). Wave notifie ensuite
notre **webhook** quand le paiement aboutit.

## Flux (réservation)

1. L'app crée/garde une réservation `pending`.
2. `POST /api/v1/payments/wave/reservations/:id/checkout` (authentifié) :
   - crée un `PaymentIntent` (`mode=reservation`, `provider=wave`, `status=pending`),
   - appelle `POST /v1/checkout/sessions` avec `client_reference = intent.id`,
   - renvoie `{ checkout_url, intent_id, session_id }`.
3. L'app **ouvre `checkout_url`** dans le navigateur système.
4. L'utilisateur paie dans l'app Wave.
5. Wave appelle `POST /api/v1/payments/wave/webhook` :
   - la **signature** (`Wave-Signature: t=…,v1=…`) est vérifiée sur le **corps brut**
     (HMAC-SHA256 de `timestamp + body` avec `WAVE_WEBHOOK_SECRET`),
   - sur `checkout.session.completed` (ou `payment_status=succeeded`), la réservation
     passe `confirmed`, un `Payment` accepté est créé (idempotent), l'intent passe `validated`.
6. Wave redirige l'utilisateur vers `WAVE_SUCCESS_URL` / `WAVE_ERROR_URL`
   (l'`intent_id` est ajouté en query pour l'écran de retour).

## Endpoints

| Méthode | Route | Accès | Rôle |
| --- | --- | --- | --- |
| POST | `/payments/wave/reservations/:id/checkout` | authentifié | crée la session, renvoie `wave_launch_url` |
| POST | `/payments/wave/webhook` | **public** | reçoit les événements Wave (signature vérifiée) |
| GET | `/payments/wave/status` | admin | diagnostic de configuration (booléens) |

## Variables d'environnement (Render)

| Variable | Rôle |
| --- | --- |
| `WAVE_API_KEY` | clé API (Bearer). **Vide = Wave désactivé.** |
| `WAVE_API_BASE` | défaut `https://api.wave.com` |
| `WAVE_WEBHOOK_SECRET` | secret de vérification des webhooks |
| `WAVE_SIGNING_SECRET` | *(optionnel)* signature des requêtes sortantes |
| `WAVE_AGGREGATED_MERCHANT_ID` | *(agrégateurs uniquement)* |
| `WAVE_SUCCESS_URL` / `WAVE_ERROR_URL` | pages de retour après paiement |

Les secrets ne sont jamais commités : ils se mettent uniquement dans Render.

## Modèle de données

`payment_intents` reçoit : `provider`, `provider_session_id`,
`provider_transaction_id`, `checkout_url` (migration
`2026-10-06_payment_intents_provider_columns.sql`).

## Ce qui reste à faire quand les clés arrivent

- Renseigner les variables Wave dans Render + enregistrer l'URL du webhook
  (`https://api.gbonhifoot.com/api/v1/payments/wave/webhook`) dans le portail Wave.
- Confirmer le format exact de signature des webhooks (doc « Webhooks »).
- Brancher le **checkout Wave côté app mobile** (ouvrir `checkout_url` dans le navigateur,
  puis écran d'attente qui interroge l'état de la réservation).
- Câbler le même flux pour l'**inscription en ligue** (`mode=leagues`) — non encore finalisé.
- Tester de bout en bout en sandbox, puis activer en production.
