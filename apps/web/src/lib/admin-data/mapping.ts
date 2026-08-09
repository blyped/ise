/**
 * Champs cibles du protocole d'import (0017, feuille ISE_IMPORT — doc 23
 * §8-16) et proposition de mapping à partir des en-têtes du fichier.
 *
 * La proposition n'est qu'une AIDE : rien n'est enregistré sans que
 * l'opérateur ait vu et validé chaque ligne (SA-041). La liste des champs
 * et des transformations est celle des contraintes de la table
 * `private.import_column_mappings` — pas une invention côté client.
 */

export const IMPORT_TARGET_FIELDS = [
  'source_id',
  'first_name',
  'middle_names',
  'last_name',
  'display_name',
  'promotion_year',
  'email',
  'phone',
  'secondary_phone',
  'country',
  'city',
  'current_position',
  'organization',
  'sector',
  'linkedin_url',
  'notes_source',
  'last_known_update',
  'source_name',
  'source_date',
  'import_comment',
] as const;

export type ImportTargetField = (typeof IMPORT_TARGET_FIELDS)[number];

export const IMPORT_TARGET_LABELS: Record<ImportTargetField, string> = {
  source_id: 'Identifiant source (SRC0001)',
  first_name: 'Prénom',
  middle_names: 'Autres prénoms',
  last_name: 'Nom',
  display_name: 'Nom affiché',
  promotion_year: 'Année de promotion',
  email: 'Email',
  phone: 'Téléphone',
  secondary_phone: 'Téléphone secondaire',
  country: 'Pays',
  city: 'Ville',
  current_position: 'Poste actuel',
  organization: 'Organisation',
  sector: 'Secteur',
  linkedin_url: 'URL LinkedIn',
  notes_source: 'Notes de la source',
  last_known_update: 'Dernière mise à jour connue',
  source_name: 'Nom de la source',
  source_date: 'Date de la source',
  import_comment: 'Commentaire d’import',
};

export const IMPORT_TRANSFORMS = [
  'none',
  'trim',
  'lower',
  'upper',
  'collapse_spaces',
  'normalize_name',
  'normalize_email',
  'normalize_phone',
  'parse_integer',
  'parse_date',
] as const;

export type ImportTransform = (typeof IMPORT_TRANSFORMS)[number];

export const IMPORT_TRANSFORM_LABELS: Record<ImportTransform, string> = {
  none: 'Aucune',
  trim: 'Espaces de bord retirés',
  lower: 'Minuscules',
  upper: 'Majuscules',
  collapse_spaces: 'Espaces multiples réduits',
  normalize_name: 'Nom (espaces normalisés)',
  normalize_email: 'Email (minuscules)',
  normalize_phone: 'Téléphone (E.164 si sans perte)',
  parse_integer: 'Nombre entier',
  parse_date: 'Date (ISO ou JJ/MM/AAAA)',
};

/** Transformation par défaut d'un champ cible — sans perte uniquement (§37). */
export const DEFAULT_TRANSFORM_BY_TARGET: Record<ImportTargetField, ImportTransform> = {
  source_id: 'trim',
  first_name: 'normalize_name',
  middle_names: 'normalize_name',
  last_name: 'normalize_name',
  display_name: 'collapse_spaces',
  promotion_year: 'parse_integer',
  email: 'normalize_email',
  phone: 'normalize_phone',
  secondary_phone: 'normalize_phone',
  country: 'trim',
  city: 'collapse_spaces',
  current_position: 'collapse_spaces',
  organization: 'collapse_spaces',
  sector: 'trim',
  linkedin_url: 'trim',
  notes_source: 'trim',
  last_known_update: 'parse_date',
  source_name: 'trim',
  source_date: 'parse_date',
  import_comment: 'trim',
};

function foldHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const HEADER_SUGGESTIONS: Record<string, ImportTargetField> = {
  source_id: 'source_id',
  id_source: 'source_id',
  identifiant: 'source_id',
  prenom: 'first_name',
  prenoms: 'first_name',
  first_name: 'first_name',
  firstname: 'first_name',
  autres_prenoms: 'middle_names',
  middle_names: 'middle_names',
  nom: 'last_name',
  nom_de_famille: 'last_name',
  last_name: 'last_name',
  lastname: 'last_name',
  nom_complet: 'display_name',
  display_name: 'display_name',
  promotion: 'promotion_year',
  promo: 'promotion_year',
  annee_promotion: 'promotion_year',
  annee_de_promotion: 'promotion_year',
  annee_sortie: 'promotion_year',
  promotion_year: 'promotion_year',
  email: 'email',
  e_mail: 'email',
  mail: 'email',
  courriel: 'email',
  adresse_email: 'email',
  telephone: 'phone',
  tel: 'phone',
  phone: 'phone',
  portable: 'phone',
  mobile: 'phone',
  telephone_2: 'secondary_phone',
  telephone_secondaire: 'secondary_phone',
  secondary_phone: 'secondary_phone',
  pays: 'country',
  country: 'country',
  pays_residence: 'country',
  ville: 'city',
  city: 'city',
  poste: 'current_position',
  fonction: 'current_position',
  position: 'current_position',
  poste_actuel: 'current_position',
  current_position: 'current_position',
  organisation: 'organization',
  organisme: 'organization',
  employeur: 'organization',
  entreprise: 'organization',
  societe: 'organization',
  structure: 'organization',
  organization: 'organization',
  secteur: 'sector',
  sector: 'sector',
  secteur_activite: 'sector',
  linkedin: 'linkedin_url',
  linkedin_url: 'linkedin_url',
  url_linkedin: 'linkedin_url',
  notes: 'notes_source',
  notes_source: 'notes_source',
  remarques: 'notes_source',
  observations: 'notes_source',
  derniere_maj: 'last_known_update',
  derniere_mise_a_jour: 'last_known_update',
  last_known_update: 'last_known_update',
  source: 'source_name',
  source_name: 'source_name',
  nom_source: 'source_name',
  date_source: 'source_date',
  source_date: 'source_date',
  commentaire: 'import_comment',
  commentaire_import: 'import_comment',
  import_comment: 'import_comment',
};

/** Proposition de champ cible pour une en-tête de fichier, ou `null`. */
export function suggestTargetField(header: string): ImportTargetField | null {
  return HEADER_SUGGESTIONS[foldHeader(header)] ?? null;
}

export function isImportTargetField(value: unknown): value is ImportTargetField {
  return typeof value === 'string' && (IMPORT_TARGET_FIELDS as readonly string[]).includes(value);
}

export function isImportTransform(value: unknown): value is ImportTransform {
  return typeof value === 'string' && (IMPORT_TRANSFORMS as readonly string[]).includes(value);
}
