import Link from 'next/link';
import { Alert } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { ADMIN_DATA_ROUTES } from '@/lib/routes/admin-data';
import { AdminPageHeader } from '../_components/AdminPageHeader';

export const metadata = { title: frAdminData.imports.campaigns.title };

const t = frAdminData.imports.campaigns;

/**
 * SA-044 / SA-045 — Campagnes de complétude : NON COUVERT dans cette
 * version, et l'écran le dit en toutes lettres plutôt que d'afficher des
 * compteurs inventés ou des boutons décoratifs (MASTER PROMPT §98).
 */
export default function CompletenessCampaignsPage() {
  return (
    <div className="flex flex-col gap-8">
      <AdminPageHeader
        title={t.title}
        backHref={ADMIN_DATA_ROUTES.imports}
        backLabel={frAdminData.imports.title}
      />
      <Alert variant="info" title={t.notAvailableTitle}>
        <div className="flex flex-col gap-3">
          <p>{t.notAvailableBody}</p>
          <p>{t.notAvailableAlt}</p>
          <p>
            <Link
              href={ADMIN_DATA_ROUTES.incompleteProfiles}
              className="text-primary font-medium hover:underline"
            >
              {t.goIncomplete}
            </Link>
          </p>
        </div>
      </Alert>
    </div>
  );
}
