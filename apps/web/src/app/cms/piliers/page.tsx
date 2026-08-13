import { Alert, ErrorState } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadCmsPillars, loadMediaOptions } from '@/lib/cms/queries';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { setPillarAction } from './actions';
import { PillarForm } from './PillarForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.pillars.title };

/**
 * CMS-011 (0114) — Piliers « Un reseau concu pour etre utile ».
 *
 * Quatre lignes fixes (Connecter / Entraider / Collaborer / Impacter),
 * jamais creees ni supprimees ici. Le titre et le texte de chaque pilier
 * restent le discours de marque de `fr.public.pillars` — c'est la meme
 * source que la landing publique, pour que l'ecran CMS montre exactement
 * ce que voit un visiteur. Le CMS ne pilote que l'image, une legende
 * optionnelle et le lien.
 */
export default async function CmsPillarsPage() {
  const access = await requireCmsAccess();
  const correlationId = newCorrelationId();

  const [pillars, mediaOptionsResult] = await Promise.all([
    loadCmsPillars(correlationId),
    loadMediaOptions(correlationId),
  ]);
  const mediaOptions = mediaOptionsResult.ok ? mediaOptionsResult.data : [];
  const canEdit = access.can('cms.edit');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.pillars} screenTitle={frCms.pillars.title}>
      {children}
    </CmsShell>
  );

  if (!pillars.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frCms.pillars.title} subtitle={frCms.pillars.subtitle} />
        <ErrorState
          title={frCms.common.loadError}
          description={pillars.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.pillars.title} subtitle={frCms.pillars.subtitle} />
      <Alert variant="info" title="Ce que le CMS pilote ici">
        {frCms.pillars.scopeNote}
      </Alert>

      <RowList label={frCms.pillars.title}>
        {fr.public.pillars.items.map((pillar) => {
          const row = pillars.data.find((item) => item.pillarKey === pillar.key);
          return (
            <RowCard key={pillar.key} title={pillar.title} meta={pillar.body}>
              <div className="mt-4">
                <PillarForm
                  action={setPillarAction}
                  pillarKey={pillar.key}
                  currentMediaId={row?.mediaId ?? null}
                  currentCaption={row?.caption ?? null}
                  currentLinkTarget={row?.linkTarget ?? null}
                  mediaOptions={mediaOptions}
                  canEdit={canEdit}
                />
              </div>
            </RowCard>
          );
        })}
      </RowList>
    </div>,
  );
}
