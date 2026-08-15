-- =====================================================================
-- 0135 — CINETPAY : PASSAGE AU SDK v2
--
-- CONSTAT DU PORTEUR : la migration 0134 avait branche l'ANCIENNE
-- plateforme CinetPay (`api-checkout.cinetpay.com/v2/payment`, couple
-- `apikey` + `site_id`, jeton HMAC `x-token` sur seize champs). La
-- plateforme reellement utilisee sur ses autres produits est la nouvelle :
-- `{base}/v1/...`, authentification OAuth par `api_key` + `api_password`,
-- plus AUCUN `site_id`, plus AUCUN HMAC.
--
-- RAPPEL QUI N'EST PAS UN DETAIL : la base URL de PRODUCTION est
-- `https://api.cinetpay.co` ; `https://api.cinetpay.net` est le BAC A
-- SABLE. Les intervertir ne provoque aucune erreur visible — le paiement
-- part simplement dans le vide. Le defaut applicatif est donc la
-- production (cf. packages/config/src/env.ts).
--
-- CE QUE CELA CHANGE EN BASE — DEUX POINTS, PAS UN DE PLUS :
--
--  1. LA FORME DE NOTRE REFERENCE. La nouvelle plateforme identifie le
--     paiement par `merchant_transaction_id`, qu'elle veut ALPHANUMERIQUE
--     et COURT (30 caracteres au plus, cf. l'integration de reference).
--     La reference emise en 0134 — `DON-20260814-<32 hexa>` — fait 45
--     caracteres et contient des tirets. La rogner cote applicatif
--     rendrait le rapprochement AMBIGU au retour de la notification.
--     On change donc la reference a la source : `DON` + date + 19 hexa,
--     exactement 30 caracteres, sans separateur. Notre reference EST
--     desormais le `merchant_transaction_id` : une seule identite, aucun
--     mappage a maintenir, aucune perte d'information.
--
--     Les references deja emises restent valides (la contrainte de forme
--     `^[A-Za-z0-9._-]{8,64}$` les couvre toujours) : cette migration ne
--     reecrit aucune ligne existante.
--
--  2. LA CONSERVATION DU `notify_token`. La v2 ne signe pas ses
--     notifications. Son premier controle d'authenticite est un jeton a
--     usage unique, `notify_token`, remis par CinetPay a l'INITIATION et
--     renvoye dans la notification. Pour le comparer, il faut l'avoir
--     garde — et le garder HORS de portee du navigateur, sans quoi le
--     controle ne vaudrait rien. Il vit donc dans le schema `private`,
--     et seule son EMPREINTE SHA-256 y est ecrite : meme une lecture
--     directe de la table ne permettrait pas de forger une notification.
--
-- CE QUI NE CHANGE PAS, ET NE CHANGERA PAS :
--   · aucune donnee de carte n'entre ici ;
--   · aucune cle d'API n'est stockee en base ;
--   · `settle_donation_notification()` reste la SEULE porte vers
--     `succeeded`, revoquee pour `anon` et `authenticated` ;
--   · le montant confirme reste recompare au montant enregistre ;
--   · l'idempotence reste portee par (provider, external_event_id).
--
-- Le second controle — la REVERIFICATION du paiement aupres de CinetPay
-- avant de conclure quoi que ce soit — reste entier : il est simplement
-- porte par `GET /v1/payment/{merchant_transaction_id}` au lieu de
-- `POST /v2/payment/check`. C'est lui, et lui seul, qui etablit l'issue.
--
-- Ne pas editer : toute correction passe par une nouvelle migration.
-- =====================================================================


-- =====================================================================
-- PARTIE 1 — REFERENCE COMPATIBLE `merchant_transaction_id`
--
-- Seule la fabrication de la reference change. Tout le reste de la
-- fonction — controle d'authentification, revalidation du montant contre
-- `donation_currency_rules`, journal d'audit — est repris a l'identique
-- de 0134 : cette migration ne relache AUCUN controle.
-- =====================================================================

create or replace function public.start_donation(
  p_amount_minor bigint,
  p_currency     text,
  p_is_anonymous boolean default false,
  p_message      text    default null
)
returns table (
  donation_id  uuid,
  reference    text,
  provider     text,
  amount_minor bigint,
  currency     char(3)
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile   uuid := private.current_profile_id();
  v_rule      public.donation_currency_rules%rowtype;
  v_currency  char(3);
  v_message   text;
  v_reference text;
  v_id        uuid;
begin
  if v_profile is null or not private.is_active_member() then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  v_currency := upper(coalesce(p_currency, ''))::char(3);

  select * into v_rule
  from public.donation_currency_rules r
  where r.currency = v_currency and r.is_active;

  if not found then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  -- LE MONTANT FAIT AUTORITE ICI, PAS DANS LE NAVIGATEUR.
  if p_amount_minor is null
     or p_amount_minor < v_rule.min_amount_minor
     or p_amount_minor > v_rule.max_amount_minor
     or p_amount_minor % v_rule.step_minor <> 0 then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  v_message := nullif(btrim(coalesce(p_message, '')), '');
  if v_message is not null then
    v_message := left(v_message, 500);
  end if;

  -- Reference NEUVE a chaque tentative, et desormais ALPHANUMERIQUE et
  -- longue de 30 caracteres exactement : c'est telle quelle qu'elle part
  -- comme `merchant_transaction_id` chez CinetPay et comme
  -- `client_reference_id` chez Stripe. Une tentative = une reference =
  -- une ligne. 19 caracteres hexadecimaux tires d'un uuid v4, soit 76
  -- bits d'alea ; la contrainte d'unicite reste la garde ultime.
  v_reference := 'DON'
                 || to_char(now() at time zone 'UTC', 'YYYYMMDD')
                 || upper(left(replace(gen_random_uuid()::text, '-', ''), 19));

  insert into public.donations (
    donor_profile_id, is_anonymous, amount_minor, currency,
    provider, reference, status, message
  )
  values (
    v_profile, coalesce(p_is_anonymous, false), p_amount_minor, v_currency,
    v_rule.provider, v_reference, 'pending', v_message
  )
  returning id into v_id;

  perform private.log_audit(
    'donation.started', 'donation', v_id::text, 'success',
    jsonb_build_object(
      'provider', v_rule.provider,
      'currency', v_currency,
      'amount_minor', p_amount_minor,
      'is_anonymous', coalesce(p_is_anonymous, false)
    )
  );

  return query
  select v_id, v_reference, v_rule.provider, p_amount_minor, v_currency;
end
$$;

revoke all on function public.start_donation(bigint, text, boolean, text) from public, anon;
grant execute on function public.start_donation(bigint, text, boolean, text) to authenticated;

comment on function public.start_donation(bigint, text, boolean, text) is
  'Enregistre l''INTENTION de don avant l''ouverture du guichet heberge. Revalide le montant contre donation_currency_rules : le navigateur ne fixe rien. La reference emise est alphanumerique et longue de 30 caracteres, directement utilisable comme merchant_transaction_id CinetPay v2 (0135).';


-- =====================================================================
-- PARTIE 2 — EMPREINTE DU `notify_token` DE LA NOTIFICATION CINETPAY
--
-- POURQUOI DANS `private`, ET POURQUOI UNE EMPREINTE :
-- ce jeton est le premier des deux controles d'authenticite de la v2. Le
-- laisser lisible par le donateur — `public.donations` est lisible par
-- son proprietaire — lui donnerait de quoi fabriquer une notification
-- credible. Dans `private`, aucun role de navigateur n'y accede ; sous
-- forme d'empreinte SHA-256, meme une fuite de la table ne rend pas le
-- jeton. On ne compare que des empreintes.
--
-- Ce controle n'est PAS suffisant a lui seul, et n'a jamais pretendu
-- l'etre : l'issue du paiement ne vient que de la reverification aupres
-- de CinetPay. Il ecarte simplement le bruit et les appels forges.
-- =====================================================================

create table if not exists private.donation_provider_tokens (
  donation_id         uuid primary key references public.donations (id) on delete cascade,
  -- SHA-256 hexadecimal minuscule du `notify_token` remis a l'initiation.
  -- Jamais le jeton en clair.
  notify_token_digest text        not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint donation_provider_tokens_digest_shape
    check (notify_token_digest ~ '^[0-9a-f]{64}$')
);

comment on table private.donation_provider_tokens is
  'Empreinte SHA-256 du notify_token remis par CinetPay v2 a l''initiation du paiement. Sert au PREMIER controle d''authenticite de la notification. Schema prive : hors de portee du navigateur. Jamais le jeton en clair (0135).';

-- Meme regime que private.donation_notifications (0134) : la fermeture
-- vient des PRIVILEGES, pas d'une politique RLS sans politique.
alter table private.donation_provider_tokens disable row level security;
revoke all on table private.donation_provider_tokens from anon, authenticated;

drop trigger if exists trg_donation_provider_tokens_updated on private.donation_provider_tokens;
create trigger trg_donation_provider_tokens_updated
  before update on private.donation_provider_tokens
  for each row execute function public.set_updated_at();


-- =====================================================================
-- PARTIE 3 — ENREGISTREMENT DE L'EMPREINTE (cote membre, ECRITURE SEULE)
--
-- Appelee par le serveur applicatif dans la session du donateur, juste
-- apres que CinetPay a remis le `notify_token`. Le membre ne peut la
-- viser que sur SON don, et seulement tant qu'il n'est pas conclu.
-- Aucune fonction ne relit cette empreinte cote navigateur.
-- =====================================================================

create or replace function public.record_donation_notify_token(
  p_donation_id uuid,
  p_digest      text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := private.current_profile_id();
  v_digest  text := lower(nullif(btrim(coalesce(p_digest, '')), ''));
begin
  if v_profile is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- On n'accepte qu'une empreinte bien formee : rien d'autre n'a de sens
  -- ici, et cela ferme la porte a l'ecriture d'un contenu arbitraire.
  if v_digest is null or v_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.donations d
    where d.id = p_donation_id
      and d.donor_profile_id = v_profile
      and d.provider = 'cinetpay'
      and d.status in ('pending', 'processing')
  ) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  insert into private.donation_provider_tokens (donation_id, notify_token_digest)
  values (p_donation_id, v_digest)
  on conflict (donation_id) do update
    set notify_token_digest = excluded.notify_token_digest,
        updated_at          = now();
end
$$;

revoke all on function public.record_donation_notify_token(uuid, text) from public, anon;
grant execute on function public.record_donation_notify_token(uuid, text) to authenticated;

comment on function public.record_donation_notify_token(uuid, text) is
  'Conserve l''EMPREINTE du notify_token CinetPay v2 pour le don indique. Ecriture seule, sur son propre don, avant conclusion. N''est pas une confirmation de paiement (0135).';


-- =====================================================================
-- PARTIE 4 — CONTROLE DE L'EMPREINTE (cote serveur, LECTURE SEULE)
--
-- Reservee au role serveur, comme `settle_donation_notification()`.
--
-- TOLERANCE ASSUMEE, ET IDENTIQUE A L'INTEGRATION DE REFERENCE : si
-- aucune empreinte n'a ete conservee, ou si la notification n'en porte
-- aucune, ce controle ne bloque pas — il n'a alors rien a comparer, et
-- refuser sur cette base ferait perdre des paiements REELS. Ce qui
-- tranche reste la reverification aupres de CinetPay, qui, elle, n'est
-- jamais facultative. Seule une empreinte presente des DEUX cotes et
-- DIFFERENTE fait echouer le controle.
-- =====================================================================

create or replace function public.donation_notify_token_matches(
  p_reference text,
  p_digest    text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select nullif(btrim(coalesce(p_digest, '')), '') is null
             or t.notify_token_digest = lower(btrim(p_digest))
      from public.donations d
      join private.donation_provider_tokens t on t.donation_id = d.id
      where d.reference = p_reference
    ),
    true
  );
$$;

revoke all on function public.donation_notify_token_matches(text, text)
  from public, anon, authenticated;
grant execute on function public.donation_notify_token_matches(text, text) to service_role;

comment on function public.donation_notify_token_matches(text, text) is
  'Premier controle d''authenticite d''une notification CinetPay v2 : compare l''empreinte du notify_token recu a celle conservee a l''initiation. Renvoie true s''il n''y a rien a comparer. Ne conclut JAMAIS sur l''issue du paiement (0135).';
