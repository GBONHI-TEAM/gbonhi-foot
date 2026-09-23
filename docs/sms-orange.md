# Intégration SMS Orange — vérification par OTP

Approche retenue : **OTP maison + Orange**. L'e-mail reste l'identité du compte
(aucune migration). Le backend génère un code à 6 chiffres, le stocke **haché**
(HMAC-SHA256) avec expiration, l'envoie **par SMS via Orange**, puis le vérifie.
En cas de succès (inscription/connexion), une **session Supabase** est ouverte
sans envoyer d'e-mail (via `generateLink`, jeton renvoyé au client).

## Variables d'environnement (à définir dans Render — service `gbonhi-foot-api`)

Identifiants Orange (l'un OU l'autre) :

- `ORANGE_SMS_AUTHORIZATION` : l'en-tête `Basic …` fourni par Orange Developer
  (recommandé — copie la valeur telle quelle).
- **ou** `ORANGE_SMS_CLIENT_ID` + `ORANGE_SMS_CLIENT_SECRET` (le backend calcule le Basic).

Expéditeur :

- `ORANGE_SMS_SENDER_ADDRESS` : adresse expéditeur Orange, ex. `tel:+2250000`.
- `ORANGE_SMS_SENDER_NAME` : (optionnel) nom court affiché comme expéditeur.

Optionnel (défauts corrects en production Orange) :

- `ORANGE_SMS_TOKEN_URL` (défaut `https://api.orange.com/oauth/v3/token`)
- `ORANGE_SMS_BASE_URL` (défaut `https://api.orange.com/smsmessaging/v1/outbound`)
- `OTP_HASH_SECRET` : secret de hachage des codes (sinon la clé service_role est utilisée).

## Tester la configuration (sans toucher au flux d'inscription)

Endpoint réservé au staff (SUPER_ADMIN / ADMIN), avec le token d'un admin connecté :

```
POST /api/v1/auth/sms/test
Authorization: Bearer <token_admin>
Content-Type: application/json

{ "to": "+2250700000000", "message": "Test GBONHI FOOT" }
```

Réponse `{"sent":true,"configured":true}` = tout est bon. Une erreur indique
laquelle des étapes (auth Orange, envoi) a échoué (voir les logs Render).

## Endpoints OTP (publics, avant authentification)

- `POST /api/v1/auth/phone/request-otp` `{ phone, email?, purpose? }`
  purpose ∈ `register` | `login` | `verify-phone` (défaut `register`).
  Anti-spam : 30 s minimum entre deux demandes pour un même numéro.
- `POST /api/v1/auth/phone/verify-otp` `{ phone, code, purpose?, email?, fullName? }`
  - `verify-phone` → `{ verified: true }` (l'appelant est déjà connecté).
  - `register` / `login` → `{ verified: true, email, otp, tokenHash }` : le client
    ouvre la session avec `supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })`.

## Reste à faire (câblage mobile — prochaine étape)

- `register.tsx` : remplacer l'envoi du code par e-mail par `POST /auth/phone/request-otp` (purpose `register`).
- `otp.tsx` : vérifier via `POST /auth/phone/verify-otp` puis établir la session avec `tokenHash`.
- `verify-phone.tsx` : idem avec purpose `verify-phone`, puis `updateUser({ data: { phone } })`.
- Ajuster les libellés (« code envoyé par SMS » au lieu d'« e-mail »).
