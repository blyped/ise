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
 * jamais creees ni supprimees ici. Depuis 0129, TOUT leur contenu se
 * modifie ici : titre, texte, visuel, legende optionnelle, lien.
 *
 * L'en-tete de chaque carte affiche ce que voit reellement un visiteur —
 * le texte de la base quand il existe, la valeur d'origine
 * (`fr.public.pillars.defaults`) sinon : exactement la meme regle de repli
 * que `NetworkSection`, pour que l'ecran CMS ne montre jamais autre chose
 * que la page d'accueil.
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
        {fr.public.pillars.defaults.map((pillar) => {
          const row = pillars.data.find((item) => item.pillarKey === pillar.key);
          return (
            <RowCard
              key={pillar.key}
              title={row?.title ?? pillar.title}
              meta={row?.body ?? pillar.body}
            >
              <div className="mt-4">
                <PillarForm
                  action={setPillarAction}
                  pillarKey={pillar.key}
                  currentTitle={row?.title ?? null}
                  currentBody={row?.body ?? null}
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
