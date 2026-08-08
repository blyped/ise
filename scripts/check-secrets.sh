#!/usr/bin/env bash
# Detecte les secrets versionnes. MASTER PROMPT §76.
#
# Les motifs sont assembles a l'execution pour que ce script ne se detecte
# jamais lui-meme : ecrire le motif en clair dans un fichier versionne
# rendrait le controle systematiquement rouge.
set -euo pipefail

EXCLUDE=(':!*.md' ':!scripts/check-secrets.sh' ':!pnpm-lock.yaml')
fail=0

report() { echo "::error::$1"; fail=1; }

# 1. Aucun fichier .env versionne, hormis .env.example
if git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example'; then
  report "Un fichier .env est versionne."
fi

# 2. En-tete JWT Supabase (motif reconstruit, jamais ecrit en entier)
JWT_HEADER="eyJhbGciOiJIUzI1Ni$(printf 'IsInR5cCI6IkpXVCJ9')"
if git grep -nF "$JWT_HEADER" -- . "${EXCLUDE[@]}"; then
  report "Un JWT est present dans le code."
fi

# 3. Cle secrete Supabase nouveau format
SECRET_PREFIX="sb_$(printf 'secret_')"
if git grep -nF "$SECRET_PREFIX" -- . "${EXCLUDE[@]}"; then
  report "Une cle secrete Supabase est presente dans le code."
fi

# 4. Variable service_role affectee a une valeur non vide
if git grep -nE 'SUPABASE_SERVICE_ROLE_KEY[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9_.-]{10,}' \
     -- . "${EXCLUDE[@]}"; then
  report "Une valeur semble affectee a SUPABASE_SERVICE_ROLE_KEY."
fi

# 5. .env.example ne doit porter aucune valeur pour les cles sensibles
if [ -f .env.example ]; then
  if grep -nE '^(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|EMAIL_API_KEY|SUPABASE_PROJECT_ID)=.+' .env.example; then
    report ".env.example contient une valeur pour une variable sensible."
  fi
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "Aucun secret detecte."
