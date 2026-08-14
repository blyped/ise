import Link from 'next/link';
import { frAdminSupport } from '@/i18n/admin-support';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import type { AdminSupportDashboard, AdminSupportFilters } from '@/lib/admin/queries-support';

/**
 * SA-038 — barre de filtres du cockpit des remontees.
 *
 * FORMULAIRE `GET`, donc filtres dans l'URL : partageables, rechargeables,
 * fonctionnels sans JavaScript. Changer un filtre remet a la premiere
 * page (le curseur n'est pas conserve : il ne decrit que la page en
 * cours).
 *
 * COMPOSANT LOCAL plutot que `_components/FilterBar` : cette barre a
 * besoin de deux champs DATE et d'une case a cocher, que la barre
 * partagee ne porte pas. Plutot que d'elargir un composant utilise par
 * une vingtaine d'ecrans pour un seul besoin, la variante vit ici.
 *
 * Les listes « Promotion » et « Administrateur en charge » ne proposent
 * QUE des valeurs reellement presentes dans la file : un filtre qui ne
 * ramenerait jamais rien serait un champ decoratif (MASTER PROMPT §113).
 */

const FIELD =
  'rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue h-[44px] min-w-[160px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2';

const LABEL = 'text-caption text-text-muted font-medium';

const STATUSES = [
  'open',
  'acknowledged',
  'in_progress',
  'waiting_user',
  'resolved',
  'closed',
] as const;

const URGENCIES = ['low', 'standard', 'high', 'critical'] as const;

export function SupportFilters({
  filters,
  categories,
  dashboard,
}: {
  filters: AdminSupportFilters;
  /** Natures ACTIVES du referentiel, meme liste que le formulaire membre. */
  categories: readonly { code: string; name: string }[];
  dashboard: AdminSupportDashboard | null;
}) {
  const promotions = dashboard?.promotions ?? [];
  const assignees = dashboard?.assignees ?? [];

  return (
    <form
      method="get"
      action={ADMIN_ROUTES.support}
      className="flex flex-wrap items-end gap-3"
      role="search"
      aria-label={frAdminSupport.filters.title}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="filtre-statut" className={LABEL}>
          {frAdminSupport.filters.status}
        </label>
        <select
          id="filtre-statut"
          name="statut"
          defaultValue={filters.status ?? ''}
          className={FIELD}
        >
          <option value="">Tous</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {frAdminSupport.status[value] ?? value}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtre-nature" className={LABEL}>
          {frAdminSupport.filters.category}
        </label>
        <select
          id="filtre-nature"
          name="nature"
          defaultValue={filters.categoryCode ?? ''}
          className={FIELD}
        >
          <option value="">Toutes</option>
          {categories.map((category) => (
            <option key={category.code} value={category.code}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtre-priorite" className={LABEL}>
          {frAdminSupport.filters.urgency}
        </label>
        <select
          id="filtre-priorite"
          name="priorite"
          defaultValue={filters.urgency ?? ''}
          className={FIELD}
        >
          <option value="">Toutes</option>
          {URGENCIES.map((value) => (
            <option key={value} value={value}>
              {frAdminSupport.urgency[value] ?? value}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtre-promotion" className={LABEL}>
          {frAdminSupport.filters.promotion}
        </label>
        <select
          id="filtre-promotion"
          name="promotion"
          defaultValue={filters.promotionId ?? ''}
          className={FIELD}
          disabled={promotions.length === 0}
        >
          <option value="">Toutes</option>
          {promotions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.total})
            </option>
          ))}
        </select>
        {promotions.length === 0 ? (
          <p className="text-caption text-text-muted">{frAdminSupport.filters.noPromotion}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtre-responsable" className={LABEL}>
          {frAdminSupport.filters.assignee}
        </label>
        <select
          id="filtre-responsable"
          name="responsable"
          defaultValue={filters.assigneeProfileId ?? ''}
          className={FIELD}
          disabled={assignees.length === 0}
        >
          <option value="">Tous</option>
          {assignees.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.total})
            </option>
          ))}
        </select>
        {assignees.length === 0 ? (
          <p className="text-caption text-text-muted">{frAdminSupport.filters.noAssignee}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtre-du" className={LABEL}>
          {frAdminSupport.filters.from}
        </label>
        <input
          id="filtre-du"
          name="du"
          type="date"
          defaultValue={filters.from ?? ''}
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filtre-au" className={LABEL}>
          {frAdminSupport.filters.to}
        </label>
        <input
          id="filtre-au"
          name="au"
          type="date"
          defaultValue={filters.to ?? ''}
          className={FIELD}
        />
      </div>

      <label
        htmlFor="filtre-sansreponse"
        className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-2"
      >
        <input
          id="filtre-sansreponse"
          name="sansreponse"
          type="checkbox"
          value="1"
          defaultChecked={filters.unanswered}
          className="h-5 w-5 accent-[#1D4ED8]"
        />
        {frAdminSupport.filters.unanswered}
      </label>

      <button
        type="submit"
        className="rounded-base bg-primary hover:bg-primary-hover text-body-sm focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {frAdminSupport.filters.apply}
      </button>

      <Link
        href={ADMIN_ROUTES.support}
        className="text-body-sm text-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {frAdminSupport.filters.reset}
      </Link>
    </form>
  );
}
