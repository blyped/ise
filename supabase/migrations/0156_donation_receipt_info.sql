-- =====================================================================
-- 0156_donation_receipt_info
-- E-mail de remerciement au donateur (D-219, 16/08/2026).
--
-- CONSTAT DU PORTEUR : « j'espere qu'il y a un paiement de remerciement
-- pour le don » — il n'y en avait pas. La page `/don/retour` remerciait
-- deja a l'ECRAN (« Merci. Votre don est confirme. ») des que la
-- notification serveur a serveur du prestataire avait fait passer le don a
-- `succeeded`, mais AUCUN e-mail n'etait envoye : `settle_donation_
-- notification()` (0134) ecrivait le statut et journalisait, rien de plus.
--
-- CETTE MIGRATION n'ajoute qu'une lecture, `donation_receipt_info()` :
-- coordonnees du donateur (e-mail, nom d'affichage) et montant confirme,
-- destines a composer l'e-mail cote application (`lib/donations/
-- settle.ts`, `sendDonationReceiptEmail()`). Elle ne modifie aucune table,
-- aucune contrainte, aucune RLS existante.
--
-- MEME PERIMETRE D'ACCES QUE `settle_donation_notification()` (0134) :
-- reservee a `service_role`. Un donateur connecte, ou un administrateur,
-- ne peut pas l'appeler directement — elle n'est utile qu'au serveur
-- applicatif, au moment ou il vient lui-meme de constater un succes.
--
-- `private.profile_contacts` est lu ici via SECURITY DEFINER, exactement
-- comme le reste du projet le fait deja pour cette table (jamais d'acces
-- direct depuis l'application, meme au role serveur).
-- =====================================================================

create or replace function public.donation_receipt_info(p_donation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'reference', d.reference,
    'amount_minor', d.amount_minor,
    'currency', d.currency,
    'minor_unit_exponent', coalesce(r.minor_unit_exponent, 0),
    'is_anonymous', d.is_anonymous,
    'donor_email', pc.primary_email,
    'donor_display_name', coalesce(
      p.display_name,
      nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '')
    )
  )
  from public.donations d
  left join public.donation_currency_rules r
    on r.currency = d.currency and r.provider = d.provider
  left join public.ise_profiles p on p.id = d.donor_profile_id
  left join private.profile_contacts pc on pc.profile_id = d.donor_profile_id
  where d.id = p_donation_id;
$$;

revoke all on function public.donation_receipt_info(uuid) from public, anon, authenticated;
grant execute on function public.donation_receipt_info(uuid) to service_role;

comment on function public.donation_receipt_info(uuid) is
  'Coordonnees du donateur pour l''e-mail de remerciement (D-219/0156). Reservee a service_role, comme settle_donation_notification() (0134) : jamais accessible depuis un navigateur, meme connecte.';
