-- =====================================================================
-- 0153_avatar_bucket_5mb
-- Releve la taille maximale de la photo de profil (avatar) de 2 a 5 Mo
-- — demande du porteur, 16/08/2026 (D-213).
--
-- CONTEXTE — depuis D-211 (0147, fusion des deux photos), le SEUL fichier
-- depose sous /mon-profil/en-tete alimente a la fois le medaillon PRIVE
-- (bucket `avatars`) et, si le consentement est donne, la copie PUBLIQUE
-- (bucket `landing-media`). Le bucket `landing-media` accepte deja des
-- fichiers jusqu'a 5 Mo (0068) ; c'etait le bucket `avatars`, plus
-- restrictif (2 Mo, 0027), qui bornait le depot unique — d'ou le
-- commentaire de `AVATAR_MAX_BYTES` (`en-tete/actions.ts`) qui la
-- qualifiait de « borne la plus stricte des deux buckets ».
--
-- CE QUE CETTE MIGRATION FAIT : releve `file_size_limit` du bucket
-- `avatars` de 2097152 (2 Mo) a 5242880 (5 Mo, meme valeur exacte que
-- `landing-media`) — les deux buckets partagent desormais la meme
-- limite, ce qui simplifie a nouveau `AVATAR_MAX_BYTES` a une seule
-- valeur commune plutot qu'a « la plus stricte des deux ».
-- CE QU'ELLE NE FAIT PAS : ne touche ni `allowed_mime_types`, ni aucune
-- politique RLS Storage, ni le bucket `landing-media` lui-meme.
-- =====================================================================

update storage.buckets
set file_size_limit = 5242880
where id = 'avatars';
