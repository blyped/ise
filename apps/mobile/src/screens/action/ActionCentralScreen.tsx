import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { fr } from '../../i18n/fr';

/**
 * Action centrale (+) — D-94. Sur le web, l'equivalent le plus proche est
 * le raccourci « Collaborer » de la sidebar (appels au reseau, opportunites,
 * mise en relation). Cette premiere tranche mobile se limite a la coquille
 * navigable ; le contenu reel (raccourcis de creation) suivra une fois les
 * onglets Reseau et Opportunites eux-memes construits.
 */
export function ActionCentralScreen() {
  return (
    <Screen>
      <EmptyState title={fr.nav.actionCentral} description={fr.common.comingSoonBody} />
    </Screen>
  );
}
