# Journal des décisions — Compétences ISE — Partie 8/8 : Dépôts de fichiers et retrait de la messagerie

Sections 38 à 40 du journal des décisions du projet Compétences ISE.
Index général, préambule, convention de statut (ADOPTÉE / PROVISOIRE / OUVERTE)
et décisions de cadrage : [`docs/decisions.md`](../decisions.md).

---

## 38. Dépôt de photo de profil ouvert — D-117 est levée par la disparition de son motif (D-179)

| # | Décision | Source |
| --- | --- | --- |
| D-179 | **ADOPTÉE, lève D-117** — Le dépôt de photo de profil est ouvert sur `/mon-profil/en-tete` : formulaire de téléversement, aperçu, remplacement et retrait. Validation par **signature binaire** du fichier, bornes lues dans le bucket réel (2 Mo, `png/jpeg/webp` — l'AVIF est refusé, accepté par `landing-media` mais pas par `avatars`). Écriture par `UPDATE` direct sur `ise_profiles.avatar_path` sous RLS, **sans RPC** : `authenticated` détient déjà ce privilège, borné par `ise_profiles_update_own`, et le dépôt d'octets est déjà gardé par `ise_avatars_write` (0027). Le champ `photo` rejoint les réglages de visibilité à quatre niveaux (défaut `members`, D-73/D-74). | `0126_avatar_path_scope.sql`, `mon-profil/en-tete/{page.tsx,actions.ts,AvatarForm.tsx,ProfileHeaderForm.tsx}`, `i18n/profile.ts` |

**Pourquoi D-117 tombe sans être contredite.** D-117 ne disait pas que la photo était indésirable :
elle disait qu'un bouton « Changer la photo » sans écran de téléversement derrière serait décoratif
(MASTER PROMPT §113). Le motif était l'absence de mécanisme, pas un refus de la fonction. Ce
mécanisme existe depuis `0120` (D-176) : Server Action lisant le `File` du `FormData`, vérification
de signature binaire, `storage.upload()` vers un chemin neuf, puis écriture de la référence. Il a été
transposé au bucket `avatars`, qui attendait depuis `0027`. Le motif ayant disparu, la décision
tombe : c'est le fonctionnement normal d'un écart assumé, pas un revirement.

**Le vrai trou trouvé en chemin, et qui n'avait rien à voir avec l'interface.** `avatar_path` était
une colonne texte **sans contrainte de portée** : rien n'empêchait un membre d'y enregistrer le chemin
d'un **autre** membre. La politique Storage protégeait l'écriture des octets, pas le contenu de la
colonne qui les référence. `0126` ajoute
`CHECK (avatar_path is null or avatar_path like id::text || '/%')`, calquée sur
`ise_profiles_public_photo_path_scope` posée en `0120`. Défaut préexistant, invisible tant qu'aucun
écran n'écrivait dans cette colonne — c'est-à-dire exactement tant que D-117 tenait.

**Ordre des opérations au remplacement et au retrait.** Remplacement : téléverser le nouvel objet,
puis mettre à jour la colonne, puis seulement supprimer l'ancien objet — on n'efface jamais qu'un
objet déjà déréférencé. Si l'`UPDATE` échoue, l'objet neuf est retiré : pas d'orphelin. Retrait :
octets d'abord, colonne ensuite, même motif que `withdrawPublicPhotoAction`.

**Effet de bord attendu sur la complétion.** Le bloc « Photo » comptait déjà pour 5 points sur 100 et
renvoyait vers `/mon-profil/en-tete` — un renvoi jusqu'ici **insatisfiable**, puisque l'écran de
destination annonçait la fermeture. Le score comportait donc un point structurellement inatteignable.
Il devient atteignable sans aucun changement de règle : le déclencheur `trg_completion_ise_profiles`
couvrait déjà `avatar_path`.

**Limite assumée : le mobile ne dépose pas.** `apps/mobile/package.json` ne contient ni
`expo-image-picker` ni `expo-file-system` — aucun sélecteur d'image n'est disponible. La dépendance
n'a pas été ajoutée de force. `HeaderEditScreen` fait ce qui est faisable : **afficher** la photo (URL
signée) et la **retirer**, plus le réglage de visibilité ; un texte indique que le dépôt se fait
depuis le web. Manque nommé, pas masqué.

---

## 39. Dépôt de CV et de documents de profil ouvert (D-180)

| # | Décision | Source |
| --- | --- | --- |
| D-180 | **ADOPTÉE** — Nouvel écran `/mon-profil/documents` : liste des documents déposés avec téléchargement par URL signée (5 minutes), dépôt, désignation d'un document principal, suppression. Quatre RPC en `SECURITY DEFINER`, `search_path` figé, propriétaire vérifié par `private.current_profile_id()`, auditées, `revoke … from public, anon` : `record_my_document()`, `delete_my_document()`, `set_my_primary_document()`, et `list_my_documents()` étendue par **ajout pur** de quatre clés (`storage_path`, `mime_type`, `size_bytes`, `updated_at`), sans en retirer aucune. Aucune colonne ni contrainte ajoutée à `profile_documents` : le modèle de `0008` est respecté tel quel. | `0127_profile_documents_write_api.sql`, `mon-profil/documents/`, `i18n/profile-documents.ts`, `lib/queries/profile-documents.ts`, `ApplyForms.tsx` |

**Encore un module dont seule l'interface manquait.** Table `profile_documents` (`0008`) avec sa
contrainte de préfixe, politique `profile_documents_own` (`0041`), bucket privé `profile-documents`
et sa politique d'écriture (`0027`), RPC de lecture `list_my_documents` : tout existait, sauf toute
possibilité d'**écrire**. Le bucket contenait 0 objet et la table 0 ligne — non par manque d'usage,
mais parce qu'aucun chemin n'y menait.

**Ce qui existait a été exposé, pas réinventé.** `is_primary` était déjà en place, avec un index
unique partiel sur `(profile_id, document_type)` : la notion de « CV principal » n'a pas eu à être
créée, seulement rendue accessible. De même, `allowed_mime_types` du bucket était **déjà** restrictif
(PDF, docx, xlsx, pptx, png, jpeg, webp, 10 Mo) : cette liste a été recopiée à l'identique côté RPC et
côté application plutôt que redéfinie — une seule source de vérité, celle du bucket.

**Un piège de nommage à retenir.** `profile_documents.storage_path` porte le préfixe du bucket, alors
que `storage.objects.name` ne le porte pas. Les deux valeurs se ressemblent et ne sont pas
interchangeables ; toute suppression ou signature d'URL qui les confondrait échouerait
silencieusement.

**Suppression : conséquence assumée et annoncée.** Les clés étrangères de `0008` (`SET NULL` /
`CASCADE`) détachent le document des candidatures déjà envoyées. Plutôt que de masquer cet effet,
`delete_my_document()` renvoie le nombre de candidatures concernées et l'écran l'annonce avant
confirmation.

**Le message de la candidature devient vrai.** « Le dépôt de document n'est pas encore ouvert »
(`ApplyForms.tsx`, `i18n/opportunities.ts`) était devenu faux : il est remplacé par un renvoi vers
« Mes documents ». La règle produit, elle, ne change pas — on peut toujours candidater sans CV,
le profil ISE étant joint. C'était une règle, pas une limitation technique, et elle survit à
l'ouverture du module.

**Limite assumée : aucune analyse antivirale.** Aucun antivirus n'est déployé sur ce projet. Seule
une vérification de **signature binaire** est faite : elle empêche un exécutable déguisé en PDF, elle
ne dit rien des macros d'un document Office. Le manque est écrit à trois endroits — commentaire de
migration, commentaire d'action, et texte à l'écran — plutôt que supposé connu (même exigence de
franchise que D-133). N'est pas branché non plus le nettoyage périodique des octets orphelins si le
retrait Storage échoue après la suppression en base : même limite qu'en `0120`, à traiter d'un seul
tenant le jour où un balayage Storage sera mis en place.

**Modules encore fermés après ce lot, pour mémoire.** Pièces jointes de la messagerie, pièces jointes
du support et du signalement, justificatif de vérification : les trois buckets existent
(`message-attachments`, `support-attachments`, `verification-documents`, tous privés, tous à 0 objet),
les interfaces manquent, et l'absence d'antivirus pèse plus lourd sur ces canaux — un document reçu
d'un tiers n'est pas un document que l'on dépose pour soi. Export de mes données
(`parametres/mes-donnees`) : rien n'existe, ni écran ni backend.


---

## 40. Retrait de la messagerie ISE↔ISE — ce qui disparaît, ce qui reste, et pourquoi (C-08)

Voir la ligne **C-08** de la section 0 pour la décision elle-même. Cette section consigne l'exécution,
parce qu'un abandon de module se juge autant à ce qu'il préserve qu'à ce qu'il retire.

**Le module n'avait jamais servi.** Mesure en base avant retrait : 0 ligne dans `conversations`,
`conversation_participants`, `messages`, `message_hides`, `message_attachments`, `message_reports` ;
0 objet dans le bucket `message-attachments` ; aucun écran mobile ; aucun test E2E. Le coût du retrait
était donc entièrement structurel, jamais fonctionnel.

**Ce qui est retiré (migration `0128`).** Les huit RPC de `0052` (`send_message`, `start_conversation`,
`list_my_conversations`, `get_conversation`, `list_conversation_messages`, `mark_conversation_read`,
`set_conversation_archived`, `report_message`), les quinze politiques RLS de `0047`, les deux politiques
Storage, les fonctions internes `on_message_persisted()`, `enforce_message_attachment_limit()`,
`conversation_preview()`, `is_conversation_participant()` et `can_message_profile()` — cette dernière
vérifiée sans autre appelant. Les tables sortent de la publication `supabase_realtime` et tous les
privilèges `authenticated` / `anon` sont révoqués. `my_notification_summary()` est recréée sans son
compteur `unread_messages`. Côté web : `app/messages/`, `components/messaging/`, `queries/messaging.ts`,
`routes/messaging.ts`, `i18n/messaging.ts` supprimés ; `/messages` sort de `MEMBER_ROUTE_PREFIXES` et de
la navigation membre.

**Ce qui est délibérément conservé, et pourquoi.**

Les **six tables**, vides, sans politique ni privilège. RLS activé sans aucune politique équivaut à un
refus systématique : elles sont inatteignables. C'est exactement le traitement de C-06 pour le pipeline
d'import — « inoffensives sous RLS, non consommées par aucun écran, leur suppression est un nettoyage
optionnel, pas un risque de sécurité ». Un écran retiré se remet en quelques heures ; une table
supprimée ne se retrouve pas. Les six alertes `rls_enabled_no_policy` que l'advisor Supabase signale
désormais sont donc le **résultat voulu**, pas un défaut.

Le **blocage de profil** — `profile_blocks` (créée en `0020`, pas en `0014`), `block_profile()`,
`unblock_profile()`, `list_my_blocked_profiles()`. Rien de tout cela n'appartient à la messagerie :
`profile_blocks` alimente `private.can_see_profile` et l'écran `/parametres/membres-bloques`. Le confondre
avec la messagerie aurait supprimé un mécanisme de sécurité au passage.

**`apps/web/src/lib/messaging-view.ts`**, malgré son nom. Ce fichier de 622 lignes n'est pas un module de
messagerie : c'est la couche de vue **partagée** de toute la tranche ISE-097→100, importée par les
paramètres, le support, les notifications et les membres bloqués. Le supprimer aurait cassé quatre
modules sans rapport. Seul son bloc propre à ISE-097 a été retiré, et un commentaire signale le nom
trompeur.

**Réglages devenus sans objet.** `user_settings.direct_message_policy` et `show_read_receipts` ne
pilotent plus rien. Les colonnes restent en base — `update_my_settings` applique
`coalesce(paramètre, colonne)`, les valeurs existantes sont donc intactes — mais les champs disparaissent
de l'écran des paramètres et de la projection TypeScript. Un réglage qui ne pilote plus rien ne doit pas
rester affiché (MASTER PROMPT §113). Même traitement pour `notification_types.message_received` et la
catégorie support `messages`, passés `is_active = false` : les fonctions de lecture filtrent déjà sur ce
drapeau, ils disparaissent de l'interface sans code supplémentaire.

**Les quatre liens croisés** qui proposaient d'écrire à un membre — depuis une actualité, une publication
de communauté, l'après-événement et le suivi de mentorat — pointent désormais vers **la fiche profil**.
C'est le remplacement honnête : ces boutons servaient à joindre quelqu'un, et la fiche profil est le point
d'entrée vers les canaux qui subsistent, tous porteurs d'un motif explicite (relation, introduction, appel
au réseau, mentorat).

**Conséquence non résolue, à trancher.** `block_profile()` n'était appelée que depuis l'interface de
conversation. La fonction et l'écran de déblocage subsistent, mais **plus aucun écran ne permet de
bloquer** un membre. Plutôt que d'inventer un écran non demandé, le libellé a été rendu honnête et le
point est consigné ici : soit un point d'entrée est ajouté sur la fiche profil, soit le blocage est
retiré à son tour. En l'état, un membre déjà bloqué le reste, et `can_see_profile` continue d'en tenir
compte.

**Résidus cosmétiques assumés.** Quelques libellés orphelins subsistent (`fr.nav.messages`,
`system.serviceUnavailable.services.messaging`, `admin-data.scope.messaging`, les types
`conversation`/`message` dans le formulaire de signalement, trois mentions dans les suites SQL `0001`,
`0013` et `0030`). Aucun n'ouvre de chemin d'écriture ; ils seront nettoyés à l'occasion plutôt que dans
la précipitation.

**Critère d'acceptation atteint** — scénario H du cahier des charges du module Communication : « un ISE
tente d'envoyer un message à un autre ISE → fonction inexistante et impossible via l'API ». Vérifié en
base après migration : 0 RPC de messagerie exposée, 0 politique sur les six tables, 0 privilège.
