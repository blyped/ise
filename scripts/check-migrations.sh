#!/usr/bin/env bash
# Integrite de la numerotation des migrations. MASTER PROMPT §77.
#
# Regle : deux migrations DISTINCTES ne peuvent pas porter le meme numero.
#
# Deux amenagements, et deux seulement :
#
#   1. Une migration trop volumineuse pour un seul fichier peut etre decoupee
#      en `_part1`, `_part2`, ... Ces fichiers forment UNE migration logique :
#      ils partagent legitimement le meme numero.
#
#   2. Les collisions anterieures a la mise en place de ce controle sont
#      tolerees nommement, dans scripts/migrations-collisions-historiques.txt.
#      Elles ne sont PAS renommees : une migration deja appliquee ne se
#      reedite jamais (MASTER PROMPT §77). La liste est fermee — tout nouveau
#      doublon echoue, y compris sur un numero deja present dans la liste.
#
# Un suffixe de lettre (0137b, 0140b) est un numero a part entiere : il sert
# precisement a ajouter une migration sans entrer en collision.

set -euo pipefail

MIG_DIR="supabase/migrations"
ALLOWLIST="scripts/migrations-collisions-historiques.txt"

cd "$(git rev-parse --show-toplevel)"

if [ ! -d "$MIG_DIR" ]; then
  echo "::error::Repertoire $MIG_DIR introuvable."
  exit 1
fi

fail=0
report() { echo "::error::$1"; fail=1; }

# --- Fichiers toleres ---------------------------------------------------------
TOLERATED_FILE="$(mktemp)"
UNITS_FILE="$(mktemp)"
trap 'rm -f "$TOLERATED_FILE" "$UNITS_FILE"' EXIT

if [ -f "$ALLOWLIST" ]; then
  sed -E 's/#.*//' "$ALLOWLIST" | sed -E 's/[[:space:]]+$//' | grep -v '^$' > "$TOLERATED_FILE" || true
fi

is_tolerated() { grep -qxF -- "$1" "$TOLERATED_FILE"; }

# --- Recensement : une ligne "<numero> <unite logique> <fichier>" -------------
shopt -s nullglob
files=("$MIG_DIR"/*.sql)
shopt -u nullglob

if [ ${#files[@]} -eq 0 ]; then
  report "Aucune migration trouvee dans $MIG_DIR."
  exit 1
fi

for path in "${files[@]}"; do
  file="$(basename "$path")"

  if ! [[ "$file" =~ ^([0-9]{4}[a-z]?)_ ]]; then
    report "Nom de migration invalide : $file (attendu : NNNN_intitule.sql)."
    continue
  fi
  number="${BASH_REMATCH[1]}"

  # Les fichiers _partN d'une meme migration se ramenent a une seule unite.
  unit="${file%.sql}"
  unit="$(sed -E 's/_part[0-9]+$//' <<<"$unit")"

  printf '%s\t%s\t%s\n' "$number" "$unit" "$file" >> "$UNITS_FILE"
done

# --- Detection des collisions -------------------------------------------------
duplicates="$(cut -f1,2 "$UNITS_FILE" | sort -u | cut -f1 | uniq -d || true)"

for number in $duplicates; do
  # Toutes les unites qui revendiquent ce numero, dans l'ordre alphabetique.
  mapfile -t units < <(awk -F'\t' -v n="$number" '$1==n {print $2}' "$UNITS_FILE" | sort -u)

  # La premiere unite est la migration d'origine ; les suivantes sont des
  # doublons, qui doivent etre explicitement tolerees.
  for unit in "${units[@]:1}"; do
    if is_tolerated "$unit"; then
      continue
    fi
    report "Le numero $number est deja pris : « $unit » entre en collision avec « ${units[0]} »."
  done
done

# --- Verdict ------------------------------------------------------------------
if [ "$fail" -ne 0 ]; then
  echo
  echo "Corrige en renumerotant la migration NON APPLIQUEE, ou en lui donnant un"
  echo "suffixe de lettre (ex. 0157b_intitule.sql). Ne renomme jamais une migration"
  echo "deja appliquee en production."
  exit 1
fi

total_units="$(cut -f1,2 "$UNITS_FILE" | sort -u | wc -l | tr -d ' ')"
total_files="${#files[@]}"
tolerated_count="$(wc -l < "$TOLERATED_FILE" | tr -d ' ')"
echo "$total_units migrations ($total_files fichiers), numerotation valide."
echo "$tolerated_count collision(s) historique(s) toleree(s)."
