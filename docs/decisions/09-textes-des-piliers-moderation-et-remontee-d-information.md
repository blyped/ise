# Journal des décisions — Compétences ISE — Partie 9/9 : Textes des piliers, modération et remontée d'information

Sections 41 à 43 du journal des décisions du projet Compétences ISE.
Index général, préambule, convention de statut (ADOPTÉE / PROVISOIRE / OUVERTE)
et décisions de cadrage : [`docs/decisions.md`](../decisions.md).

---

## 41. Titre et corps des piliers pilotés par le CMS — D-168 est complétée, pas contredite (D-181)

| # | Décision | Source |
| --- | --- | --- |
| D-181 | **ADOPTÉE, complète D-168** — `cms_pillars` reçoit deux colonnes éditoriales : `title` (2 à 60 caractères) et `body` (2 à 280), nullables et bornées **des deux côtés**, base comprise. `set_landing_pillar` est recréée avec une nouvelle signature ; `list_cms_pillars()` et `get_landing_pillars()` projettent les deux clés. Les quatre lignes existantes sont initialisées avec exactement les textes jusqu'ici en dur dans `apps/web/src/i18n/public.ts`, sous un `where title is null` qui garantit qu'un rejeu n'écrase jamais une saisie d'administrateur (même garde-fou que `0122`). Les textes d'i18n sont **conservés comme valeurs de repli** et renommés `fr.public.pillars.defaults` (au lieu de `items`). | `0129_landing_pillars_editable_text.sql`, `cms/piliers/{page.tsx,PillarForm.tsx,actions.ts}`, `lib/cms/mutations.ts`, `lib/public/landing-data.ts`, `i18n/{public.ts,cms.ts,fr.ts}`, `(public)/_components/sections/NetworkSection.tsx` |

**Un écran d'administration qui montre un texte sans permettre de le changer ment sur son périmètre.**
D-168 avait posé `cms_pillars` en écrivant noir sur blanc que « le titre et le corps de chaque pilier
restent un discours de marque fixe ». À l'usage, la frontière n'a pas tenu : `/cms/piliers` affiche une
carte avec son titre et son texte, et trois champs — visuel, légende, lien — qui n'y touchent pas. Le
porteur du projet l'a signalé mot pour mot (« je ne sais même plus comment on ajoute une image et
modifie ou ajoute du texte sur les encarts »). Ce n'est pas un revirement de doctrine : le titre et le
corps d'un pilier sont de la matière éditoriale, ils rejoignent la partie pilotée par le CMS comme le
reste.

**Le repli i18n n'est pas une seconde source de vérité, et le renommage sert à le dire.** La base est la
seule source du texte affiché ; l'i18n n'est plus qu'un jeu de valeurs d'usine. Appeler ce bloc `items`
laissait croire à un contenu autonome, alors qu'il ne s'agit plus que d'un défaut. `defaults` rend le
rôle **structurel** au lieu de documentaire — et ce rôle couvre deux cas où une carte vide serait un
contenu cassé plutôt qu'un choix éditorial : l'administrateur qui vide le champ, et la projection en
panne. `NULL` veut donc dire « valeur d'origine », pas « vide », et c'est exactement ce qu'annonce
l'aide du champ : laisser vide revient au texte d'origine.

**Le seed n'est pas cosmétique.** Une migration qui laisserait les deux colonnes à `NULL` serait
invisible sur la page d'accueil — le repli couvrirait tout. Mais l'administrateur ouvrirait
`/cms/piliers` sur quatre champs vides, sans savoir quoi y remettre. Initialiser les lignes avec les
textes réellement publiés rend l'écran lisible dès la première ouverture, et garantit qu'aucun contenu
ne disparaît au déploiement.

**Le défaut trouvé en chemin, et qui n'a rien à voir avec la demande.** `caption` n'avait **aucune**
contrainte côté base : sa limite de 280 caractères n'existait que dans le navigateur
(`PillarForm.tsx`, `maxLength=280`). Une écriture par RPC ou par un futur écran l'aurait ignorée sans
bruit. Les deux nouvelles colonnes sont, elles, bornées en base **et** dans le formulaire. La borne de
280 retenue pour `body` est celle déjà appliquée à la légende : le corps ne joue pas dans une autre
catégorie que la légende, il garde la même mesure.

**Ce que la décision ne fait pas.** Elle ne crée ni ne supprime de pilier — les quatre lignes de `0114`
restent fixes. Elle n'élargit pas la liste blanche de `link_target`. Et elle ne touche pas à `caption`,
qui reste un complément optionnel **au** corps, distinct de lui : trois champs de texte pour un même
encart, c'est assumé, parce qu'ils ne se lisent pas au même endroit de la carte.

---

## 42. Blocage d'un membre et suppression de compte par l'administration — la conséquence non résolue de C-08 est tranchée (D-182)

| # | Décision | Source |
| --- | --- | --- |
| D-182 | **ADOPTÉE** — Un encart « Signaler ou bloquer » est ajouté à la colonne latérale de `/profil/[profileId]` : il rouvre l'appel à `block_profile()`, orphelin depuis le retrait de la messagerie, et renvoie au signalement existant. Côté modération, `admin_delete_member_account()` supprime le **compte** d'un membre : permission `profiles.moderate` vérifiée dans la fonction, motif d'au moins 10 caractères, confirmation par saisie du mot « SUPPRIMER », journalisation d'audit y compris des refus, ligne dans `moderation_actions` avec le type neuf `account_deletion`. **D-19 est tenue** : `auth.users` est supprimé, le profil ISE subsiste en `claim_status = 'unclaimed'` / `profile_status = 'referenced'`. | `0130_admin_account_deletion.sql`, `profil/[profileId]/{page.tsx,MemberSafetyCard.tsx,actions.ts}`, `administration/membres/[profileId]/{page.tsx,DeleteAccountAction.tsx,actions.ts}`, `i18n/moderation-membre.ts` |

**Le retrait de la messagerie avait emporté le seul point d'entrée du blocage.** La section 40 le
consignait comme une conséquence non résolue, à trancher : `block_profile()` n'était appelée que depuis
l'interface de conversation, si bien que plus aucun écran ne permettait de bloquer, alors que l'écran de
déblocage, la table `profile_blocks` et les quinze politiques qui la lisent étaient intacts. Il ne
manquait aucun mécanisme — il manquait un bouton. C'est ce bouton qui est posé, à l'endroit naturel : la
fiche du membre concerné.

**Pas de bouton « Débloquer » sur la fiche, et c'est une conséquence, pas un oubli.** `can_see_profile`
tient déjà compte de `profile_blocks` : si la fiche s'affiche, c'est qu'aucun blocage n'existe. Un
bouton « Débloquer » y serait par construction inatteignable. Le déblocage reste où il a toujours été,
dans `/parametres/membres-bloques` — et c'est vers cet écran que l'on est redirigé après un blocage,
pour que l'action reste réversible en un clic depuis l'endroit où elle est listée.

**Le dialogue énumère ce que le blocage fait et ce qu'il ne fait pas.** Bloquer n'est pas signaler, et ne
déclenche aucune sanction : c'est une mesure personnelle et bidirectionnelle. Plutôt que d'afficher un
avertissement générique, le dialogue liste les effets réels — disparition réciproque des fiches, refus
des demandes de relation, d'introduction, de recommandation, de mentorat et des invitations — et dit
explicitement que l'autre membre n'en est pas informé et qu'aucune modération n'est saisie. Le
signalement, lui, reste offert à côté, par `/aide/signaler`.

**Le constat le plus important de ce lot : le système d'étoiles n'existe pas.** La demande initiale
visait des « notations de complaisance » à sanctionner. Vérification faite en base et dans les écrans,
il n'y a rien à sanctionner parce qu'il n'y a rien à noter. `recommendations` (`0085`) ne porte ni note
ni score : un texte, une compétence, un contexte, un statut. Le niveau de compétence affiché est
**déclaré par l'intéressé lui-même** (D-75), pas attribué par un tiers. `score_profile_pair` est un
score de **matching calculé**, jamais alimenté par un membre. Et les recommandations ne s'affichent que
sur `/mon-profil/recommandations`, jamais sur la fiche d'un tiers. Aucune modération n'a donc été
construite pour cet objet : elle n'aurait été atteignable depuis aucun écran, et aurait ajouté une
surface de produit décorative pour un problème inexistant (MASTER PROMPT §113). Le point est écrit ici
plutôt que traité en silence, parce que la demande reviendra.

**Supprimer un compte n'est pas supprimer un profil.** Le profil est un objet de l'annuaire : il précède
le compte et lui survit. `admin_delete_member_account()` dissocie les deux — `auth.users` supprimé,
`user_id` remis à `NULL` par la clé étrangère, réclamation rouverte — sauf si le profil était
`archived`, auquel cas l'archivage décidé par la modération est préservé : supprimer un compte ne doit
pas désarchiver un profil. Un profil suspendu, à l'inverse, restait un compte ouvert : session,
authentification et jetons d'appareil conservés. C'est ce trou-là qui est comblé, à la suite de
`admin_set_profile_status()` et `admin_record_moderation_action()` (`0077`), qui restent la réponse
proportionnée et ne sont pas touchés.

**Portrait public purgé, documents privés conservés.** Le passage de `user_id` à `NULL` est un `UPDATE`
sur `ise_profiles` : le déclencheur `ise_profiles_public_photo_guard` posé en `0120` se déclenche donc et
purge l'objet du bucket public ainsi que les champs associés — vérifié, aucune image publique ne survit à
la suppression. Les documents de profil, eux, ne sont pas purgés : ils suivent le profil, qui subsiste,
et leur bucket est privé. C'est un choix explicite, pas un oubli.

**Ce que ce lot ne fait pas.** Aucun test RLS n'a été écrit pour `0130` : la fonction est en
`SECURITY DEFINER` avec vérification de permission interne, mais la suite négative qui le prouverait
n'existe pas. Rien n'a été fait côté mobile — ni encart de sécurité sur la fiche profil, ni écran de
modération. Deux manques nommés, pas masqués.

---

## 43. « Remonter une information » — premier volet du module Communication (D-183)

| # | Décision | Source |
| --- | --- | --- |
| D-183 | **ADOPTÉE** — Le volet « Remonter une information » **étend le module support existant** (`0016`, `0027`, `0049`, `0053`, `0076`) au lieu d'en créer un second. Sont ajoutés : un référentiel de catégories par **nature** (huit natures ; les quinze catégories « par module » passent `is_active = false`), la colonne `support_categories.default_urgency`, un sixième statut `acknowledged`, une quatrième priorité, `admin_set_support_ticket_urgency`, `attach_support_file`, `private.sanitize_support_context`, cinq compteurs de cockpit comptés en base et six familles de filtres. **D-85 est tenue** : le demandeur ne choisit pas sa priorité. | `0131_support_communication_reporting.sql`, `aide/demandes/{page.tsx,nouvelle/page.tsx,[ticketId]/page.tsx}`, `aide/actions.ts`, `components/support/{TicketForm.tsx,TicketReplyForm.tsx}`, `administration/support/{page.tsx,SupportFilters.tsx,[ticketId]/}`, `lib/queries/support.ts`, `lib/admin/queries-support.ts`, `lib/{support-attachments.ts,support-context.ts}`, `i18n/{support.ts,admin-support.ts}` |

**Un second module aurait doublé ce qui existait déjà.** Le fil de suivi, la référence lisible, le
cockpit agent, les transitions atomiques et le contexte technique étaient en place depuis longtemps.
Créer un module « Remonter une information » à côté aurait produit deux boîtes de réception, deux
historiques et deux endroits où chercher un ticket. Ce qui manquait n'était pas un module : c'était un
axe de classement, un statut, un niveau de priorité, une voie d'écriture pour les pièces jointes, et de
quoi trier dans le cockpit.

**Les catégories changent d'axe, elles ne sont pas renommées.** Les anciennes décrivaient le **module**
concerné (« Mon compte », « Opportunités », « Communautés »…) ; les huit nouvelles décrivent la **nature**
de la remontée : bug, problème technique, suggestion, idée, demande d'aide, données de profil, contenu
incorrect, autre. Ce n'est pas la même question posée autrement, c'est une autre question. Les quinze
anciennes sont **désactivées par `is_active`, jamais supprimées** : `support_tickets.category_code` les
référence par clé étrangère, et une catégorie désactivée reste lisible sur les tickets historiques tout
en disparaissant des formulaires, que le code filtre déjà sur ce drapeau. Supprimer aurait cassé
l'historique pour ne rien gagner.

**Six statuts, et un septième qui aurait menti.** `open` (Nouveau), `acknowledged` (Pris en charge, seul
code réellement ajouté), `in_progress`, `waiting_user` (affiché « Répondu »), `resolved`, `closed`. La
tentation était d'ajouter un état « Répondu » distinct de « en attente du membre ». C'est le **même état
vu des deux côtés** : l'administration a écrit, la main revient au membre. Deux codes auraient produit
deux états indiscernables en base, impossibles à filtrer proprement et sûrs de diverger. Un seul code,
deux libellés selon le lecteur. `acknowledged`, lui, **assigne le ticket à l'agent qui le prend** :
afficher « Pris en charge » sans savoir par qui aurait été un statut qui ment.

**Quatre priorités, et D-85 tenue.** `low` / `standard` / `high` / `critical`. Le demandeur ne les voit
pas et n'en choisit aucune : la priorité initiale est posée par le système à partir de la nature
(`urgency_source = 'system'`), et seule l'administration requalifie, en traçant son identité. Le point
est que la RPC de requalification **n'existait pas** : le cockpit affichait depuis le début une priorité
que personne ne pouvait changer. `admin_set_support_ticket_urgency` comble cet écart. Aucun délai cible
n'est introduit : il n'en existe toujours aucun, conformément à D-85.

**Pièces jointes : tout existait sauf la voie d'écriture.** La table, le bucket privé, les politiques RLS
et les politiques Storage étaient en place — mais aucune RPC, aucune interface, et `create_support_ticket`
ne renvoyait même pas l'identifiant du message auquel rattacher un fichier. D'où le résultat mesurable :
zéro objet dans le bucket, non par manque d'usage mais parce qu'aucun chemin n'y menait. C'est le même
constat que pour les documents de profil (D-180), au même endroit du raisonnement. `attach_support_file`,
le dépôt côté membre et la lecture par URL signées ouvrent le canal.

**Aucun antivirus n'est disponible sur ce déploiement, et c'est écrit à l'écran.** Le manque est annoncé
au membre au moment du dépôt, pas supposé connu et surtout pas simulé par un contrôle décoratif. Même
exigence de franchise que D-133 et D-180 — avec ici une circonstance aggravante déjà notée en section 39 :
une pièce jointe de support est un document **reçu d'un tiers**, pas un document que l'on dépose pour soi.

**Cockpit : ce qui existait n'a pas été refait.** La liste avec badges, la pagination par curseur, le
détail complet et les transitions atomiques étaient déjà là. Ont été ajoutés cinq compteurs **comptés en
base** — pas dérivés d'une page de résultats, qui n'aurait compté que ce qu'elle affiche — et les filtres
par nature, priorité, promotion, responsable, sans-réponse et période. Le contexte technique joint à une
remontée est borné par **liste blanche** (`private.sanitize_support_context`) plutôt que par liste noire,
et **n'est jamais renvoyé au demandeur** : il sert au diagnostic, il n'a pas à être relu ni contesté par
celui qui l'a involontairement produit.

**Ce fil n'est pas une messagerie.** Il relie un ISE et l'administration, verticalement, conformément à
C-08 : les politiques d'accès de `0049` restent seules maîtresses, aucune n'est élargie ici. Un membre ne
peut toujours pas écrire à un autre membre.

**Ce que ce volet ne fait pas.** Le dépôt de pièce jointe **côté administration** n'est pas livré : un
agent peut lire les fichiers du membre, pas en joindre à sa réponse. Aucun test RLS n'a été ajouté pour
`0131`. Et ce n'est qu'un premier volet : la diffusion descendante du module Communication —
administration vers un ISE, une promotion ou tous — reste à construire.
