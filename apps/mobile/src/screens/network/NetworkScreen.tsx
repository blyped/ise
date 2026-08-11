import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { fr } from '../../i18n/fr';

/**
 * Réseau — coquille D-94. Porte le recherche/matching (ISE-030+) et les
 * relations (ISE-038→046) sur le web ; route mobile encore "à définir" dans
 * la traceability matrix. Placeholder navigable pour cette première tranche.
 */
export function NetworkScreen() {
  return (
    <Screen>
      <EmptyState title={fr.nav.network} description={fr.common.comingSoonBody} />
    </Screen>
  );
}
