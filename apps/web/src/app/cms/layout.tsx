import type { ReactNode } from 'react';
import { requireCmsAccess } from '@/lib/cms/permissions';

/**
 * GARDE D'ENTREE DU BACK-OFFICE (ADDENDUM §29).
 *
 * Ce layout enveloppe TOUTES les routes `/cms/**`, y compris celles qui
 * seront ajoutees plus tard. Un compte sans `cms.read` est redirige vers
 * SYS-006 avant tout rendu : il n'atteint pas la route.
 *
 * Ce n'est pas la seule barriere, et ce n'est pas la principale. La RLS
 * des huit tables `cms_*` et la verification de permission dans chaque
 * fonction `SECURITY DEFINER` refusent de toute facon. Masquer un ecran
 * ne protege rien ; ici on evite seulement d'afficher une page vide a
 * quelqu'un qui n'a rien a y faire.
 */
export default async function CmsLayout({ children }: { children: ReactNode }) {
  await requireCmsAccess();
  return children;
}
