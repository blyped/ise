import type { ReactNode } from 'react';
import { requireAdminAccess } from '@/lib/admin/permissions';

/**
 * GARDE D'ENTREE DU BACK-OFFICE SUPERADMIN — meme modele que
 * `app/cms/layout.tsx` (SYS-006).
 *
 * Ce layout enveloppe TOUTES les routes `/administration/**`, y compris
 * celles du lot imports / analytics / parametres / audit livre en
 * parallele. Un compte sans AUCUNE permission d'administration est
 * redirige avant tout rendu : il n'atteint pas la route.
 *
 * Ce n'est ni la seule barriere, ni la principale : chaque page exige
 * ensuite SA permission precise (`requireAdminPermission`), et chaque
 * fonction `admin_*` (0076, 0077) revalide en base via
 * `private.has_permission()`. Masquer un ecran ne protege rien ; ici on
 * evite seulement d'afficher une coquille vide.
 */
export default async function AdministrationLayout({ children }: { children: ReactNode }) {
  await requireAdminAccess();
  return children;
}
