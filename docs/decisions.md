# Journal des décisions — Compétences ISE

Ce document consigne tout arbitrage rendu lorsque les sources se contredisent, conformément au
MASTER PROMPT §2 (hiérarchie : sécurité > règles du MASTER PROMPT > maquettes & spécifications >
détails visuels) et §114 (« prendre une décision raisonnable, la documenter, continuer »).

Statut des décisions : **ADOPTÉE** (appliquée au code) · **PROVISOIRE** (à confirmer par le métier)
· **OUVERTE** (bloquante, en attente).

---

## 32. Suivi des clics sur les liens d'e-mail Supabase — `/auth/callback` comme point d'instrumentation unique (D-173)

| #     | Décision | Source |
| ----- | -------- | ------ |
| D-173 | **ADOPTÉE** — Chaque atterrissage sur `/auth/callback` (succès ET échec) est journalisé dans `private.auth_link_events`, via `public.log_auth_link_event()` (SECURITY DEFINER, exposée à `anon` ET `authenticated`). Couvre les trois usages réels de ce point d'entrée unique : confirmation de compte (ISE-002), réinitialisation de mot de passe (ISE-003), activation des comptes pré-créés (D-161). Lecture agrégée par type de lien via `public.admin_list_auth_link_events()` (exige `promotions.manage`), affichée sur un nouvel écran dédié `/administration/promotions/liens`. Liste blanche `anon_function_grant` de `private.security_baseline_violations()` étendue à 13 fonctions (`log_auth_link_event` ajoutée). Migrations `0118_auth_link_events.sql` et `0119_auth_link_events_public_rpc.sql` (correctif de schéma, voir plus bas). | `0118_auth_link_events.sql`, `0119_auth_link_events_public_rpc.sql`, `apps/web/src/app/auth/callback/route.ts`, `apps/web/src/app/administration/promotions/liens/page.tsx`, `apps/web/src/lib/admin/queries-auth-link-events.ts`, `apps/web/src/i18n/admin-campaigns.ts` |

**Le trou constaté.** Sur les 252 comptes ISE à provisionner (D-161), seuls 51 avaient reçu une
invitation à ce jour, envoyée via `inviteUserByEmail` (Supabase Auth natif). Le porteur a demandé
comment savoir qui avait *réellement cliqué* sur le lien reçu. Avant cette décision, rien dans
l'application ne journalisait ce clic : le seul proxy disponible était `auth.users.last_sign_in_at`
et `confirmed_at`, interrogés hors application. Ce proxy est aveugle à une distinction pourtant
essentielle pour relancer les bonnes personnes : un compte qui n'a **jamais cliqué** le lien et un
compte qui a **cliqué mais dont le lien était déjà invalide ou expiré** aboutissent tous deux au même
état final (`invited_and_signed_in = false`). Sans ce suivi, impossible de savoir s'il faut relancer
un e-mail (lien jamais vu) ou renvoyer un lien frais (lien vu mais mort).

**Pourquoi `/auth/callback` est le bon — et le seul — point d'instrumentation.** C'est l'unique
endroit de l'application où atterrit un clic sur un lien d'e-mail émis par Supabase Auth, quel que
soit son motif (confirmation, réinitialisation, invitation) et quel que soit son format (`?code=`
PKCE ou `?token_hash=&type=` classique). Toute autre approche (journaliser au moment de l'envoi,
scruter les logs Supabase) mesurerait l'envoi ou la remise, pas le clic réel de l'utilisateur.
Instrumenter cet unique point d'entrée capture les trois usages en une seule fois, sans dupliquer la
logique à chaque écran d'origine.

**Pourquoi les échecs sont journalisés aussi, pas seulement les succès.** C'est le cœur de la
décision : journaliser uniquement les succès aurait reproduit exactement le même angle mort que
`auth.users.last_sign_in_at` (un échec et une absence de clic restent indistinguables). En
journalisant CHAQUE atterrissage — `outcome = 'success'` ou `'error'`, avec le `error.code` Supabase
le cas échéant —, la ligne `(link_type = 'invite', outcome = 'error')` devient la preuve directe
qu'un destinataire a cliqué mais que le jeton était déjà mort, distincte de l'absence totale de ligne
(jamais cliqué).

**Schéma et sécurité.** La table vit dans `private` (D-16 : jamais exposée à l'API publique), avec
un `CHECK` fermé sur `link_type` (`signup`/`invite`/`magiclink`/`recovery`/`email_change`/`email`/
`code`) et sur `outcome` (`success`/`error`). `user_id` référence `auth.users(id) on delete set null`,
nullable : un jeton déjà invalide ne résout jamais personne. La fonction d'écriture valide les mêmes
listes fermées en PL/pgSQL avant l'insertion (défense en profondeur, au cas où le `CHECK` seul
laisserait passer une erreur moins lisible).

**Détail technique : la fonction d'écriture a dû être déplacée de `private` vers `public` en cours de
route (migration 0119, correctif de 0118).** Le brief initial prévoyait `private.log_auth_link_event`
avec `GRANT EXECUTE` à `anon`. Un test fonctionnel (`set role anon; select
private.log_auth_link_event(...)`) a immédiatement révélé le problème : `anon` n'a pas `USAGE` sur le
schéma `private` (`has_schema_privilege('anon', 'private', 'USAGE')` renvoie `false`), donc l'appel
échoue par `permission denied for schema private` avant même d'atteindre le corps de la fonction —
et PostgREST, qui route `supabase.rpc()`, n'expose de toute façon que le schéma `public` (vérifié :
aucune fonction `private.*` n'est appelée en RPC ailleurs dans `apps/web`). Le même appel aurait
échoué en production. Migration 0119 : la fonction devient `public.log_auth_link_event` (même corps,
mêmes `GRANT`), la TABLE reste `private.auth_link_events` — seul le point d'entrée RPC change de
schéma, la donnée reste hors de portée de l'API publique. Reproduit ensuite avec succès :
`set role anon; select public.log_auth_link_event('invite', 'success', null, null);` insère bien une
ligne, supprimée immédiatement après (pas de donnée de test laissée en base).

**La limite assumée.** Ce suivi capture le clic à partir du moment où il atteint `/auth/callback` —
c'est-à-dire une fois que Supabase a reçu la requête et tente de valider (ou refuse de valider) le
jeton. Il ne capture PAS les ouvertures d'e-mail ni les clics mesurés en amont par Resend lui-même
(pixel d'ouverture, clic sur le lien avant redirection), faute d'accès aux réglages du compte Resend
(webhook non configuré à ce jour). Si le porteur souhaite un jour ce niveau de détail supplémentaire
(ouverture avant clic, taux d'ouverture), il faudrait l'activer séparément côté tableau de bord Resend
et le brancher à un nouveau webhook — hors périmètre de cette décision, qui répond au besoin exprimé
(qui a cliqué, et le lien a-t-il fonctionné) sans dépendance externe supplémentaire.

**Placement de l'écran admin : un nouvel écran dédié, pas une greffe sur la fiche campagne.** Les
événements de `private.auth_link_events` sont une vue GLOBALE de la plateforme — tous types de liens,
toutes promotions, campagnes ou invitations individuelles (ISE-070) confondues — alors que la fiche
campagne existante (`/administration/promotions/[promotionId]/campagnes/[campaignId]`, SA-013→015)
exige un `campaignId` précis et affiche des statistiques propres à CETTE campagne. Y greffer un
résumé global aurait été trompeur : le lecteur aurait raisonnablement associé les chiffres à la
campagne affichée, alors qu'ils couvrent toute la plateforme. Un écran séparé,
`/administration/promotions/liens` (même permission `promotions.manage`, même thème fonctionnel),
évite cette confusion. Pas d'entrée dans la navigation principale — même choix que les sous-écrans
`campagnes` et `invitations`, déjà accessibles uniquement depuis la liste des promotions (SA-008) —
un lien y a été ajouté à côté du lien existant vers les signalements.
