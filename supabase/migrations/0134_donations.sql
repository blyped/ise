-- =====================================================================
-- 0134 — FAIRE UN DON (Stripe & CinetPay)
--
-- DEMANDE DU PORTEUR : « Ajouter Faire un don dans le menu de chaque ISE,
-- avec le module de paiement de CinetPay et Stripe (j'ai un compte). »
--
-- ---------------------------------------------------------------------
-- CE QUE CETTE MIGRATION NE FAIT PAS, ET NE FERA JAMAIS
-- ---------------------------------------------------------------------
-- AUCUNE DONNEE DE CARTE BANCAIRE N'ENTRE ICI. Aucun PAN, aucun CVV,
-- aucune date d'expiration, aucun jeton de carte. Le paiement se deroule
-- INTEGRALEMENT sur les pages HEBERGEES par les prestataires (Stripe
-- Checkout, guichet CinetPay) : notre application redirige, puis attend
-- une notification serveur a serveur. Nous restons donc hors du
-- perimetre PCI-DSS, et cette table ne contient que des references
-- opaques et des montants.
--
-- AUCUNE CLE D'API N'EST STOCKEE EN BASE. Les secrets vivent dans
-- l'environnement de deploiement (Vercel) et ne sont lus que par le
-- serveur applicatif. Rien ici, rien dans un commentaire, rien dans un
-- seed.
--
-- ---------------------------------------------------------------------
-- REGLE CARDINALE DU PROJET APPLIQUEE A L'ARGENT : AUCUN ETAT INVENTE
-- ---------------------------------------------------------------------
-- Un don n'est « reussi » QUE lorsque le prestataire l'a confirme par sa
-- notification serveur a serveur (webhook Stripe signe, notify_url
-- CinetPay dont la transaction est REVERIFIEE aupres de l'API CinetPay).
--
-- Le retour du navigateur sur la page de succes NE VAUT RIEN : cette URL
-- est publique, devinable et rejouable par n'importe qui. La fonction
-- qui fait avancer un don, `public.settle_donation_notification()`, est
-- REVOQUEE pour `anon` et `authenticated` : une session de navigateur ne
-- peut pas l'appeler, meme en forgeant la requete. Seul le role
-- `service_role`, detenu par le serveur applicatif dans le traitement du
-- webhook, y a acces.
--
-- ---------------------------------------------------------------------
-- LE MONTANT FAIT AUTORITE COTE SERVEUR
-- ---------------------------------------------------------------------
-- Le navigateur n'envoie jamais un montant qui serait cru sur parole :
-- `public.start_donation()` revalide le montant contre
-- `public.donation_currency_rules`, seule source des bornes, du pas et
-- des montants proposes. Un montant hors bornes, mal aligne sur le pas,
-- ou dans une devise inconnue est REFUSE — la ligne n'est pas creee.
-- Au retour, le montant confirme par le prestataire est RECOMPARE a
-- celui enregistre : en cas d'ecart, le don n'est pas marque reussi.
--
-- ---------------------------------------------------------------------
-- POLITIQUE DE DEVISES : UNE DEVISE PAR PRESTATAIRE, AUCUNE CONVERSION
-- ---------------------------------------------------------------------
--   · CinetPay -> XOF uniquement. C'est sa zone (UEMOA), son mobile money,
--     sa devise native. Le XOF n'a PAS de sous-unite : 1 XOF = 1 unite
--     minimale (exposant 0). CinetPay impose en outre un montant
--     multiple de 5 -> `step_minor = 5`.
--   · Stripe   -> EUR uniquement. C'est la voie des cartes
--     internationales. L'EUR a 2 decimales : les montants sont donc
--     stockes en CENTIMES (exposant 2).
--
-- AUCUN TAUX DE CHANGE N'EST APPLIQUE NULLE PART. Nous n'en connaissons
-- aucun qui fasse autorite, et en inventer un fausserait la comptabilite
-- du porteur. Le donateur choisit sa voie de paiement, et le montant qui
-- part est celui de la devise de cette voie. Les totaux sont donc
-- presentes PAR DEVISE, jamais additionnes.
--
-- ---------------------------------------------------------------------
-- IDEMPOTENCE
-- ---------------------------------------------------------------------
-- Les deux prestataires previennent explicitement qu'une notification
-- peut arriver PLUSIEURS FOIS. `private.donation_notifications` porte une
-- cle unique (prestataire, identifiant d'evenement) : la deuxieme
-- reception ne cree rien, ne modifie rien, et repond « duplicate ».
-- Aucun don n'est donc compte deux fois.
--
-- Ne pas editer : toute correction passe par une nouvelle migration.
-- =====================================================================


-- =====================================================================
-- PARTIE 1 — PERMISSION `donations.read`
--
-- FAUT-IL UNE PERMISSION NOUVELLE ? OUI.
-- Les 21 permissions existantes couvrent des contenus et des personnes,
-- aucune ne couvre l'ARGENT. La rattacher a `analytics.read` (agregats
-- anonymes) exposerait l'identite des donateurs a un analyste ; a
-- `settings.manage` melangerait le reglage de la plateforme et un
-- registre financier ; a `ops.read` donnerait la liste des dons a
-- l'exploitation technique. Le registre des dons nomme des personnes et
-- des sommes : il merite sa propre clef, accordee au seul superadmin
-- pour l'instant.
-- =====================================================================

insert into private.permissions (code, domain, action, description) values
  ('donations.read', 'donations', 'read', 'Consulter le registre des dons et leur suivi.')
on conflict (code) do nothing;

-- Le superadmin recoit toute permission nouvelle (meme regle qu'en 0004).
insert into private.role_permissions (role_id, permission_id)
select r.id, p.id
from private.roles r cross join private.permissions p
where r.code = 'superadmin' and p.code = 'donations.read'
on conflict do nothing;


-- =====================================================================
-- PARTIE 2 — REFERENTIEL DES DEVISES ET DES MONTANTS
--
-- Une table de reference plutot que des constantes dans le code : le
-- montant fait autorite cote serveur, et l'ecran de don comme la
-- fonction de creation lisent la MEME source. Deux listes qui
-- divergeraient seraient une porte ouverte.
-- =====================================================================

create table if not exists public.donation_currency_rules (
  currency            char(3)  primary key,
  -- Un prestataire par devise (cf. politique en tete de fichier).
  provider            text     not null,
  -- Nombre de decimales de la devise : 0 pour le XOF, 2 pour l'EUR.
  -- Sert a FORMATER, jamais a convertir.
  minor_unit_exponent smallint not null,
  min_amount_minor    bigint   not null,
  max_amount_minor    bigint   not null,
  -- Pas impose par le prestataire (CinetPay : multiple de 5).
  step_minor          bigint   not null default 1,
  -- Montants proposes a l'ecran, en unite minimale, ordre d'affichage.
  preset_amounts      bigint[] not null default '{}',
  is_active           boolean  not null default true,
  sort_order          integer  not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint donation_currency_rules_provider_check
    check (provider in ('stripe', 'cinetpay')),
  constraint donation_currency_rules_exponent_check
    check (minor_unit_exponent between 0 and 4),
  constraint donation_currency_rules_bounds_check
    check (min_amount_minor > 0 and max_amount_minor >= min_amount_minor),
  constraint donation_currency_rules_step_check
    check (step_minor >= 1 and min_amount_minor % step_minor = 0)
);

comment on table public.donation_currency_rules is
  'Bornes, pas et montants proposes pour un don, PAR DEVISE. Source unique : l''ecran affiche ce que la fonction de creation revalide. Une devise = un prestataire, aucune conversion (0134).';
comment on column public.donation_currency_rules.minor_unit_exponent is
  'Decimales de la devise (XOF 0, EUR 2). Sert au formatage a l''affichage, jamais a une conversion entre devises.';
comment on column public.donation_currency_rules.step_minor is
  'Pas impose par le prestataire. CinetPay exige un montant multiple de 5 : step_minor = 5 pour le XOF.';

insert into public.donation_currency_rules
  (currency, provider, minor_unit_exponent, min_amount_minor, max_amount_minor, step_minor, preset_amounts, is_active, sort_order)
values
  -- XOF : unite minimale = 1 franc. Multiple de 5 impose par CinetPay.
  ('XOF', 'cinetpay', 0,   500, 5000000, 5,
   array[1000, 2000, 5000, 10000, 25000, 50000]::bigint[], true, 10),
  -- EUR : unite minimale = 1 centime. 5 / 10 / 25 / 50 / 100 / 250 euros.
  ('EUR', 'stripe',   2,   200, 1000000, 1,
   array[500, 1000, 2500, 5000, 10000, 25000]::bigint[], true, 20)
on conflict (currency) do update
  set provider            = excluded.provider,
      minor_unit_exponent = excluded.minor_unit_exponent,
      min_amount_minor    = excluded.min_amount_minor,
      max_amount_minor    = excluded.max_amount_minor,
      step_minor          = excluded.step_minor,
      preset_amounts      = excluded.preset_amounts,
      is_active           = excluded.is_active,
      sort_order          = excluded.sort_order,
      updated_at          = now();

drop trigger if exists trg_donation_currency_rules_updated on public.donation_currency_rules;
create trigger trg_donation_currency_rules_updated
  before update on public.donation_currency_rules
  for each row execute function public.set_updated_at();


-- =====================================================================
-- PARTIE 3 — LE REGISTRE DES DONS
-- =====================================================================

create table if not exists public.donations (
  id                 uuid primary key default gen_random_uuid(),

  -- NULLABLE, pour deux raisons distinctes :
  --   · un don peut etre fait ANONYMEMENT (`is_anonymous`), et le lien
  --     vers le profil est alors conserve pour le recu du donateur mais
  --     jamais affiche a autrui ;
  --   · un profil supprime (0130) ne doit pas effacer la trace
  --     comptable du don -> `on delete set null`.
  donor_profile_id   uuid references public.ise_profiles (id) on delete set null,
  is_anonymous       boolean not null default false,

  -- ARGENT : ENTIER, EN PLUS PETITE UNITE MONETAIRE. Jamais un flottant.
  -- Un `numeric` conviendrait aussi, mais l'entier interdit d'emblee
  -- toute demi-unite qu'aucun prestataire n'accepterait.
  amount_minor       bigint  not null,
  currency           char(3) not null references public.donation_currency_rules (currency),

  provider           text not null,

  -- NOTRE reference, generee cote serveur, envoyee au prestataire
  -- (`transaction_id` CinetPay, `client_reference_id` Stripe). C'est par
  -- elle que la notification retrouve le don.
  reference          text not null unique,
  -- La reference DU PRESTATAIRE (identifiant de session Checkout, jeton
  -- de paiement CinetPay). Renseignee apres la creation du guichet.
  provider_reference text,
  -- Statut brut renvoye par le prestataire, conserve tel quel pour la
  -- tracabilite ; il ne pilote rien, `status` seul fait foi.
  provider_status    text,

  status             text not null default 'pending',
  failure_reason     text,

  -- Mot du donateur, facultatif, borne. Aucune donnee sensible ici.
  message            text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Passage au guichet du prestataire (redirection effective).
  redirected_at      timestamptz,
  -- HORODATAGE DE VERITE : rempli UNIQUEMENT par la notification serveur
  -- a serveur confirmee. Tant qu'il est NULL, aucun euro ni franc n'est
  -- constate.
  confirmed_at       timestamptz,
  -- Derniere notification prise en compte pour ce don (diagnostic).
  last_notified_at   timestamptz,

  constraint donations_amount_positive check (amount_minor > 0),
  constraint donations_provider_check   check (provider in ('stripe', 'cinetpay')),
  constraint donations_status_check
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  constraint donations_message_length   check (message is null or length(message) <= 500),
  constraint donations_reference_shape  check (reference ~ '^[A-Za-z0-9._-]{8,64}$'),
  -- COHERENCE FORTE : un don « reussi » a forcement un horodatage de
  -- confirmation, et reciproquement. Impossible d'ecrire un succes sans
  -- l'instant ou il a ete constate.
  constraint donations_success_needs_confirmation check (
    (status = 'succeeded' and confirmed_at is not null)
    or (status <> 'succeeded' and confirmed_at is null)
  )
);

create index if not exists donations_donor_idx
  on public.donations (donor_profile_id, created_at desc)
  where donor_profile_id is not null;
create index if not exists donations_status_idx
  on public.donations (status, created_at desc);
create index if not exists donations_provider_reference_idx
  on public.donations (provider, provider_reference)
  where provider_reference is not null;
create index if not exists donations_succeeded_idx
  on public.donations (currency, confirmed_at desc)
  where status = 'succeeded';

comment on table public.donations is
  'Registre des dons. Aucune donnee de carte bancaire (paiement sur pages hebergees Stripe / CinetPay). Le statut « succeeded » n''est pose QUE par une notification serveur a serveur verifiee, jamais par un retour de navigateur (0134).';
comment on column public.donations.amount_minor is
  'Montant en PLUS PETITE UNITE MONETAIRE, entier. XOF : francs (exposant 0). EUR : centimes (exposant 2). Jamais un flottant, jamais converti d''une devise a l''autre.';
comment on column public.donations.status is
  'pending (cree, guichet pas encore ouvert) / processing (donateur redirige) / succeeded (CONFIRME par le prestataire) / failed (refuse par le prestataire) / cancelled (abandonne, sur constat du prestataire). Aucune de ces valeurs n''est posee depuis le navigateur.';
comment on column public.donations.confirmed_at is
  'Instant de la confirmation SERVEUR A SERVEUR. NULL tant que le prestataire n''a rien confirme, meme si l''utilisateur a vu une page de succes.';
comment on column public.donations.reference is
  'Reference emise par NOUS et transmise au prestataire (transaction_id CinetPay / client_reference_id Stripe). Sert de cle de rapprochement a la notification.';

drop trigger if exists trg_donations_updated on public.donations;
create trigger trg_donations_updated
  before update on public.donations
  for each row execute function public.set_updated_at();


-- =====================================================================
-- PARTIE 4 — REGISTRE D'IDEMPOTENCE DES NOTIFICATIONS
--
-- Dans le schema PRIVE : ce journal contient la charge utile brute
-- renvoyee par le prestataire. Aucun membre, aucun administrateur n'y
-- accede par PostgREST ; seules les fonctions SECURITY DEFINER l'ecrivent.
-- =====================================================================

create table if not exists private.donation_notifications (
  id                bigint generated always as identity primary key,
  provider          text        not null,
  -- Identifiant d'evenement DU PRESTATAIRE. Stripe : `evt_...`. CinetPay
  -- ne fournit pas d'identifiant d'evenement : on compose une cle stable
  -- a partir de la transaction et du statut constate (cf. la fonction de
  -- reglement), ce qui rend la re-livraison du MEME etat inoperante.
  external_event_id text        not null,
  donation_id       uuid        references public.donations (id) on delete set null,
  reference         text,
  outcome           text        not null,
  payload           jsonb       not null default '{}'::jsonb,
  received_at       timestamptz not null default now(),
  constraint donation_notifications_provider_check check (provider in ('stripe', 'cinetpay')),
  constraint donation_notifications_unique unique (provider, external_event_id)
);

create index if not exists donation_notifications_donation_idx
  on private.donation_notifications (donation_id, received_at desc);

comment on table private.donation_notifications is
  'Journal d''idempotence des notifications de paiement. La contrainte unique (provider, external_event_id) garantit qu''une meme notification recue deux fois ne produit qu''un seul effet (0134).';

alter table public.donation_currency_rules enable row level security;
alter table public.donation_currency_rules force row level security;
alter table public.donations               enable row level security;
alter table public.donations               force row level security;

-- Schema PRIVE : jamais expose par PostgREST, aucun privilege accorde a
-- `anon` ni a `authenticated`. RLS N'EST PAS activee ici, par ALIGNEMENT
-- avec les 28 autres tables du schema `private` : leur fermeture vient des
-- PRIVILEGES, pas d'une politique. Une table isolee avec RLS et zero
-- politique n'ajouterait aucune securite reelle et ferait remonter
-- `rls_enabled_no_policy` a chaque passage du security advisor.
alter table private.donation_notifications disable row level security;


-- =====================================================================
-- PARTIE 5 — RLS
--
-- Refus par defaut (0020). On ouvre le strict necessaire :
--   · les regles de devise sont lisibles par tout membre actif — c'est
--     ce qui alimente l'ecran de don ;
--   · un membre ne voit QUE ses propres dons ;
--   · `donations.read` voit tout le registre ;
--   · PERSONNE n'ecrit en direct : ni INSERT, ni UPDATE, ni DELETE. Les
--     seules ecritures passent par les fonctions ci-dessous, qui sont
--     SECURITY DEFINER et revalident tout.
-- =====================================================================

-- `anon` n'a rien a voir ici : le don est une action de MEMBRE, la landing
-- publique n'expose aucun de ces objets (rappel de la ligne de base 0020).
revoke all on public.donation_currency_rules from anon;
revoke all on public.donations               from anon;
revoke all on table private.donation_notifications from anon, authenticated;

drop policy if exists ise_donation_currency_rules_read on public.donation_currency_rules;
create policy ise_donation_currency_rules_read on public.donation_currency_rules
  for select to authenticated
  using (is_active and private.is_active_member());

drop policy if exists ise_donations_read_own on public.donations;
create policy ise_donations_read_own on public.donations
  for select to authenticated
  using (
    (donor_profile_id is not null and donor_profile_id = private.current_profile_id())
    or private.has_permission('donations.read')
  );

-- Aucune politique d'ecriture, volontairement. Un `insert` direct depuis
-- une session de navigateur est refuse par RLS ; c'est le comportement
-- voulu, pas un oubli.


-- =====================================================================
-- PARTIE 6 — CREATION D'UN DON (cote membre)
--
-- Ce que cette fonction NE FAIT PAS : elle ne contacte aucun
-- prestataire. Elle enregistre l'intention AVANT que le guichet ne
-- s'ouvre — c'est exactement la recommandation de CinetPay
-- (« Il faut enregistrer les informations sur le paiement dans la base
-- de donnees avant d'afficher le guichet »). Le serveur applicatif
-- appelle ensuite l'API du prestataire avec la reference retournee ici.
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
  -- Bornes, pas et entierete sont revalides contre le referentiel. Un
  -- montant negatif, nul, hors bornes ou mal aligne ne cree aucune ligne.
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

  -- Reference NEUVE a chaque tentative. CinetPay le rappelle : reutiliser
  -- un `transaction_id` en changeant un parametre ne produit pas de
  -- nouveau jeton. Une tentative = une reference = une ligne.
  v_reference := 'DON-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-'
                 || upper(replace(gen_random_uuid()::text, '-', ''));
  v_reference := left(v_reference, 64);

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
  'Enregistre l''INTENTION de don avant l''ouverture du guichet heberge. Revalide le montant contre donation_currency_rules : le navigateur ne fixe rien. Ne contacte aucun prestataire (0134).';


-- =====================================================================
-- PARTIE 7 — MARQUER LA REDIRECTION VERS LE GUICHET
--
-- `pending` -> `processing`. Ce n'est PAS un succes : c'est le constat
-- que le guichet a bien ete ouvert et que la reference du prestataire
-- est connue. Le membre ne peut le faire que sur SON don.
-- =====================================================================

create or replace function public.mark_donation_redirected(
  p_donation_id        uuid,
  p_provider_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := private.current_profile_id();
  v_status  text;
begin
  if v_profile is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select d.status into v_status
  from public.donations d
  where d.id = p_donation_id and d.donor_profile_id = v_profile
  for update;

  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Un don deja confirme n'est jamais ramene en arriere.
  if v_status <> 'pending' then
    return;
  end if;

  update public.donations
     set status             = 'processing',
         provider_reference = nullif(btrim(coalesce(p_provider_reference, '')), ''),
         redirected_at      = now()
   where id = p_donation_id;
end
$$;

revoke all on function public.mark_donation_redirected(uuid, text) from public, anon;
grant execute on function public.mark_donation_redirected(uuid, text) to authenticated;

comment on function public.mark_donation_redirected(uuid, text) is
  'Constate l''ouverture du guichet heberge et enregistre la reference du prestataire. N''est PAS une confirmation de paiement (0134).';


-- =====================================================================
-- PARTIE 8 — REGLEMENT PAR NOTIFICATION SERVEUR A SERVEUR
--
-- SEULE PORTE VERS `succeeded`. Trois protections empilees :
--
--   1. ACCES. La fonction est revoquee pour `public`, `anon` et
--      `authenticated`. Un navigateur ne peut pas l'appeler. Seul le
--      role `service_role` — detenu par le serveur applicatif dans le
--      traitement du webhook, apres verification de la signature — y a
--      acces.
--
--   2. IDEMPOTENCE. L'insertion dans `private.donation_notifications`
--      porte la contrainte unique (provider, external_event_id). Si la
--      notification a deja ete traitee, la fonction repond « duplicate »
--      et NE TOUCHE A RIEN.
--
--   3. MONTANT. Le montant confirme par le prestataire est recompare a
--      celui enregistre. En cas d'ecart, le don n'est PAS marque reussi :
--      on journalise `amount_mismatch` et on laisse l'etat en place. Un
--      ecart de montant est une anomalie a instruire, pas un succes a
--      constater.
--
-- MACHINE A ETATS (aucune etape non constatee) :
--      pending / processing -> succeeded | failed | cancelled
--      failed / cancelled   -> succeeded   (confirmation tardive : les
--                              operateurs mobile money notifient d'abord
--                              WAITING_FOR_CUSTOMER, CinetPay avertit
--                              explicitement de ne pas conclure a l'echec)
--      succeeded            -> TERMINAL, rien ne le defait.
-- =====================================================================

create or replace function public.settle_donation_notification(
  p_provider           text,
  p_external_event_id  text,
  p_reference          text,
  p_outcome            text,
  p_provider_reference text    default null,
  p_provider_status    text    default null,
  p_amount_minor       bigint  default null,
  p_currency           text    default null,
  p_failure_reason     text    default null,
  p_payload            jsonb   default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_donation   public.donations%rowtype;
  v_rows       integer := 0;
  v_currency   char(3);
  v_new_status text;
begin
  if p_provider not in ('stripe', 'cinetpay') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if p_outcome not in ('succeeded', 'failed', 'cancelled', 'pending') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_external_event_id, '')), '') is null then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  -- --- 2. IDEMPOTENCE -------------------------------------------------
  insert into private.donation_notifications
    (provider, external_event_id, reference, outcome, payload)
  values
    (p_provider, p_external_event_id, p_reference, p_outcome, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, external_event_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    -- Deja vue : la contrainte unique a absorbe la re-livraison. On ne
    -- touche a rien et on repond 200 au prestataire, qui cesse de reessayer.
    return jsonb_build_object('result', 'duplicate');
  end if;

  -- --- Rapprochement --------------------------------------------------
  select * into v_donation
  from public.donations d
  where d.reference = p_reference
  for update;

  if not found then
    perform private.log_audit(
      'donation.notification_unknown', 'donation', p_reference, 'failure',
      jsonb_build_object('provider', p_provider, 'outcome', p_outcome),
      null, null, 'unknown_reference', 'system'
    );
    return jsonb_build_object('result', 'unknown_reference');
  end if;

  update private.donation_notifications
     set donation_id = v_donation.id
   where provider = p_provider and external_event_id = p_external_event_id;

  update public.donations
     set last_notified_at   = now(),
         provider_status    = coalesce(nullif(btrim(coalesce(p_provider_status, '')), ''), provider_status),
         provider_reference = coalesce(nullif(btrim(coalesce(p_provider_reference, '')), ''), provider_reference)
   where id = v_donation.id;

  -- --- Terminal : rien ne defait un succes ----------------------------
  if v_donation.status = 'succeeded' then
    return jsonb_build_object('result', 'already_succeeded', 'donation_id', v_donation.id);
  end if;

  -- --- Statut d'attente : on ne conclut a rien ------------------------
  -- CinetPay : « votre systeme recoit une premiere notification avec le
  -- statut WAITING_FOR_CUSTOMER [...] si vous mettez a jour le paiement
  -- comme echec definitivement, cela explique pourquoi les paiements
  -- [...] ne sont pas correctement traites ». On laisse donc l'etat tel
  -- quel plutot que d'inventer une issue.
  if p_outcome = 'pending' then
    return jsonb_build_object('result', 'still_pending', 'donation_id', v_donation.id);
  end if;

  -- --- 3. CONTROLE DU MONTANT ------------------------------------------
  if p_outcome = 'succeeded' then
    if p_amount_minor is null or p_currency is null then
      perform private.log_audit(
        'donation.amount_unverifiable', 'donation', v_donation.id::text, 'failure',
        jsonb_build_object('provider', p_provider),
        null, null, 'amount_unverifiable', 'system'
      );
      return jsonb_build_object('result', 'amount_unverifiable', 'donation_id', v_donation.id);
    end if;

    v_currency := upper(p_currency)::char(3);

    if p_amount_minor <> v_donation.amount_minor or v_currency <> v_donation.currency then
      perform private.log_audit(
        'donation.amount_mismatch', 'donation', v_donation.id::text, 'failure',
        jsonb_build_object(
          'provider', p_provider,
          'expected_amount_minor', v_donation.amount_minor,
          'expected_currency', v_donation.currency,
          'received_amount_minor', p_amount_minor,
          'received_currency', v_currency
        ),
        null, null, 'amount_mismatch', 'system'
      );
      return jsonb_build_object('result', 'amount_mismatch', 'donation_id', v_donation.id);
    end if;
  end if;

  v_new_status := p_outcome;

  -- Un don deja `failed`/`cancelled` ne redescend pas vers l'autre issue
  -- negative : seule une confirmation le fait avancer.
  if v_donation.status in ('failed', 'cancelled') and v_new_status <> 'succeeded' then
    return jsonb_build_object('result', 'unchanged', 'donation_id', v_donation.id);
  end if;

  update public.donations
     set status         = v_new_status,
         confirmed_at   = case when v_new_status = 'succeeded' then now() else null end,
         failure_reason = case
                            when v_new_status = 'succeeded' then null
                            else left(nullif(btrim(coalesce(p_failure_reason, '')), ''), 300)
                          end
   where id = v_donation.id;

  perform private.log_audit(
    'donation.' || v_new_status, 'donation', v_donation.id::text, 'success',
    jsonb_build_object(
      'provider', p_provider,
      'amount_minor', v_donation.amount_minor,
      'currency', v_donation.currency,
      'previous_status', v_donation.status
    ),
    null, null, null, 'system'
  );

  return jsonb_build_object(
    'result', 'updated',
    'donation_id', v_donation.id,
    'status', v_new_status
  );
end
$$;

-- ACCES : uniquement le serveur applicatif (service_role). Ni le
-- navigateur du donateur, ni un administrateur connecte ne peuvent
-- appeler cette fonction — une page de retour est falsifiable, pas une
-- notification signee.
revoke all on function public.settle_donation_notification(text, text, text, text, text, text, bigint, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.settle_donation_notification(text, text, text, text, text, text, bigint, text, text, jsonb)
  to service_role;

comment on function public.settle_donation_notification(text, text, text, text, text, text, bigint, text, text, jsonb) is
  'UNIQUE porte vers le statut « succeeded ». Idempotente (private.donation_notifications), controle le montant confirme, refuse toute regression depuis un succes. Reservee a service_role : un retour de navigateur ne peut pas l''appeler (0134).';


-- =====================================================================
-- PARTIE 9 — LECTURES
-- =====================================================================

-- Etat d'UN don, pour la page de retour. Volontairement pauvre : elle ne
-- dit que ce qui est REELLEMENT constate. Tant que la notification n'est
-- pas arrivee, elle repond « en cours de verification » — jamais
-- « merci, c'est paye ».
create or replace function public.get_my_donation(p_reference text)
returns table (
  id           uuid,
  reference    text,
  provider     text,
  amount_minor bigint,
  currency     char(3),
  status       text,
  confirmed_at timestamptz,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.reference, d.provider, d.amount_minor, d.currency,
         d.status, d.confirmed_at, d.created_at
  from public.donations d
  where d.reference = p_reference
    and d.donor_profile_id is not null
    and d.donor_profile_id = private.current_profile_id()
$$;

revoke all on function public.get_my_donation(text) from public, anon;
grant execute on function public.get_my_donation(text) to authenticated;

comment on function public.get_my_donation(text) is
  'Etat reel d''un don du membre courant. Ne confirme jamais un paiement que le prestataire n''a pas confirme (0134).';


-- Synthese administrative : totaux PAR DEVISE (aucune addition entre
-- devises, aucun taux de change) et comptages par statut.
create or replace function public.admin_donation_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_by_currency jsonb;
  v_by_status   jsonb;
begin
  if not private.has_permission('donations.read') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_by_currency
  from (
    select d.currency,
           r.minor_unit_exponent,
           count(*)                    as donation_count,
           sum(d.amount_minor)::bigint as total_amount_minor
    from public.donations d
    join public.donation_currency_rules r on r.currency = d.currency
    where d.status = 'succeeded'
    group by d.currency, r.minor_unit_exponent
    order by d.currency
  ) t;

  select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb) into v_by_status
  from (select d.status, count(*) as n from public.donations d group by d.status) s;

  return jsonb_build_object('by_currency', v_by_currency, 'by_status', v_by_status);
end
$$;

revoke all on function public.admin_donation_summary() from public, anon;
grant execute on function public.admin_donation_summary() to authenticated;

comment on function public.admin_donation_summary() is
  'Totaux des dons REELLEMENT confirmes, PAR DEVISE (jamais additionnees : aucun taux de change ne fait autorite ici). Exige donations.read (0134).';
