import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadMediaAssets } from '@/lib/cms/queries';
import { formatBytes } from '@/lib/cms/image-metadata';
import { formatDate } from '@/lib/cms/format';
import { landingMediaUrl } from '@/lib/public/landing-data';
import { StorageImage } from '@/components/media/StorageImage';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader, SearchField } from '../_components/PageHeader';
import { DangerAction } from '../_components/DangerAction';
import { MediaMetadataForm, MediaUploadForm } from './MediaForms';
import { deleteMediaAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.media.title };

/**
 * CMS-008 — Mediatheque (ADDENDUM §38).
 *
 * Recherche, metadonnees, texte alternatif obligatoire, dimensions,
 * references d'usage. Les references sont COMPTEES sur
 * `cms_carousel_items`, `cms_partner_campaigns` et
 * `cms_landing_organizations` (0146) : un media dit « utilise 2 fois »
 * l'est reellement deux fois.
 *
 * VIGNETTES REELLES depuis 0068. Le bucket `landing-media` est public :
 * chaque media a une URL chargeable, et la mediatheque montre donc le
 * fichier lui-meme, pas un rectangle gris. La vignette est rendue dans une
 * boite a rapport d'aspect FIXE — la grille ne bouge pas pendant le
 * chargement — et un fichier absent du bucket laisse simplement la boite
 * vide, sans icone brisee.
 *
 * Un media depose avant 0068 dans `public-assets` reste liste, sans
 * vignette : ce bucket est prive. Il ne parait pas non plus sur la vitrine.
 * Le voir ici est le seul moyen de s'en apercevoir et de le re-importer.
 */
export default async function CmsMediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireCmsAccess();
  const params = await searchParams;
  const rawQuery = params['recherche'];
  const query = typeof rawQuery === 'string' && rawQuery.trim().length > 0 ? rawQuery.trim() : null;

  const correlationId = newCorrelationId();
  const media = await loadMediaAssets(query, correlationId);
  const canManage = access.can('cms.media.manage');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.media} screenTitle={frCms.media.title}>
      {children}
    </CmsShell>
  );

  if (!media.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frCms.media.title} subtitle={frCms.media.subtitle} />
        <ErrorState
          title={frCms.common.loadError}
          description={media.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const assets = media.data;

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.media.title} subtitle={frCms.media.subtitle} />

      {/*
        Le bucket est public : le dire, en toutes lettres, a l'endroit ou l'on
        depose. Une regle de confidentialite qui n'est ecrite que dans une
        migration n'est pas connue de la personne qui televerse.
      */}
      <Alert variant="warning" title={frCms.media.publicBucketTitle}>
        {frCms.media.publicBucketBody}
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCms.media.uploadTitle}</CardTitle>
        </CardHeader>
        <MediaUploadForm canManage={canManage} />
      </Card>

      <SearchField
        action={CMS_ROUTES.media}
        placeholder="Rechercher un média…"
        defaultValue={query ?? ''}
      />

      {assets.length === 0 ? (
        <EmptyState title={frCms.media.emptyTitle} description={frCms.media.emptyBody} />
      ) : (
        <ul aria-label={frCms.media.title} className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => {
            const usageTotal =
              asset.usage.carousel + asset.usage.campaigns + asset.usage.organizations;
            const thumbnailUrl = landingMediaUrl({
              bucket: asset.bucketId,
              path: asset.storagePath,
              alt: asset.altText,
              credit: asset.credit,
              width: asset.width,
              height: asset.height,
              // 0141 — la mediatheque n'affiche jamais un cadrage propre au
              // membre (c'est un reglage de « Ma vitrine publique », pas un
              // attribut du media lui-meme) : les trois cles existent dans
              // `LandingMedia` mais valent toujours `null` ici, exactement
              // comme pour tout media qui n'est pas le portrait consenti
              // d'un membre (carrousel, actualites, piliers, partenaires...).
              focalX: null,
              focalY: null,
              zoom: null,
            });
            return (
              <li key={asset.id} className="border-border bg-surface rounded-lg border p-5">
                <div className="flex flex-col gap-2">
                  {/*
                    `alt` = le texte alternatif REEL du media, pas un libelle
                    generique : la mediatheque doit montrer ce que la vitrine
                    annoncera. `sizes` correspond aux trois colonnes de la
                    grille.
                  */}
                  <div className="bg-surface-muted rounded-base relative mb-1 aspect-[16/9] w-full overflow-hidden">
                    {thumbnailUrl === null ? null : (
                      <StorageImage
                        src={thumbnailUrl}
                        alt={asset.altText}
                        sizes="(max-width: 639px) 100vw, (max-width: 1279px) 50vw, 320px"
                        className="object-contain"
                      />
                    )}
                  </div>
                  <p className="text-body-sm text-text-primary break-all font-semibold">
                    {asset.filename}
                  </p>
                  <p className="text-caption text-text-secondary">{asset.altText}</p>
                  <p className="text-caption text-text-muted">
                    {asset.width !== null && asset.height !== null
                      ? `${frCms.media.dimensions} : ${asset.width} × ${asset.height}`
                      : `${frCms.media.dimensions} : ${frCms.common.none}`}
                    {' · '}
                    {frCms.media.size} : {formatBytes(asset.sizeBytes)}
                    {' · '}
                    {asset.mimeType}
                  </p>
                  <p className="text-caption text-text-muted">{formatDate(asset.createdAt)}</p>

                  <div className="mt-1 flex flex-wrap gap-2">
                    {asset.variants.length === 0 ? (
                      <Badge tone="warning">{frCms.media.noVariant}</Badge>
                    ) : (
                      asset.variants.map((variant) => (
                        <Badge key={variant.id} tone="info">
                          {variant.variantKind}
                        </Badge>
                      ))
                    )}
                  </div>

                  <div className="mt-2">
                    <p className="text-caption text-text-primary font-medium">
                      {frCms.media.usageTitle}
                    </p>
                    {usageTotal === 0 ? (
                      <p className="text-caption text-text-muted">{frCms.media.usageNone}</p>
                    ) : (
                      <p className="text-caption text-text-secondary">
                        {[
                          asset.usage.carousel > 0
                            ? `${asset.usage.carousel} ${frCms.media.usageCarousel}`
                            : null,
                          asset.usage.campaigns > 0
                            ? `${asset.usage.campaigns} ${frCms.media.usageCampaign}`
                            : null,
                          asset.usage.organizations > 0
                            ? `${asset.usage.organizations} ${frCms.media.usageOrganization}`
                            : null,
                        ]
                          .filter((label): label is string => label !== null)
                          .join(' · ')}
                      </p>
                    )}
                  </div>

                  <details className="border-border mt-3 rounded-lg border p-3">
                    <summary className="text-body-sm text-primary min-h-[44px] cursor-pointer list-none font-medium">
                      {frCms.actions.edit}
                    </summary>
                    <div className="mt-3 flex flex-col gap-4">
                      <MediaMetadataForm media={asset} canManage={canManage} />
                      <DangerAction
                        action={deleteMediaAction}
                        fields={{ mediaId: asset.id, usageCount: String(usageTotal) }}
                        triggerLabel={frCms.actions.delete}
                        title={frCms.media.deleteTitle}
                        description={
                          usageTotal > 0 ? frCms.media.deleteBlocked : frCms.media.deleteBody
                        }
                        confirmLabel={frCms.media.deleteConfirm}
                        disabled={!canManage}
                        disabledReason={frCms.common.forbidden}
                      />
                    </div>
                  </details>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Alert variant="warning" title={frCms.media.pipelineTitle}>
        {frCms.media.pipelineGap}
      </Alert>
    </div>,
  );
}
