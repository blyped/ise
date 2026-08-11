import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { fr } from '../../i18n/fr';

/** Opportunités — coquille D-94. Voir NetworkScreen.tsx pour le contexte. */
export function OpportunitiesScreen() {
  return (
    <Screen>
      <EmptyState title={fr.nav.opportunities} description={fr.common.comingSoonBody} />
    </Screen>
  );
}
