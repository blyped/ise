import { frAdmin } from '@/i18n/admin';

export interface FilterSelect {
  name: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
}

/**
 * Barre de filtres des listes SA : formulaire `GET`, donc filtres dans
 * l'URL — partageables, rechargeables, fonctionnels sans JavaScript.
 * Changer un filtre remet a la premiere page (le curseur n'est pas
 * conserve : il ne decrit que la page en cours).
 */
export function FilterBar({
  action,
  search,
  selects,
}: {
  action: string;
  search?: { name: string; placeholder: string; value: string } | undefined;
  selects: readonly FilterSelect[];
}) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3" role="search">
      {search !== undefined ? (
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <label htmlFor="admin-recherche" className="text-caption text-text-muted font-medium">
            {frAdmin.common.search}
          </label>
          <input
            id="admin-recherche"
            name={search.name}
            type="search"
            defaultValue={search.value}
            placeholder={search.placeholder}
            className="rounded-base border-border bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue h-[44px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </div>
      ) : null}

      {selects.map((select) => (
        <div key={select.name} className="flex flex-col gap-1">
          <label
            htmlFor={`filtre-${select.name}`}
            className="text-caption text-text-muted font-medium"
          >
            {select.label}
          </label>
          <select
            id={`filtre-${select.name}`}
            name={select.name}
            defaultValue={select.value}
            className="rounded-base border-border bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue h-[44px] min-w-[160px] border px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <option value="">{frAdmin.common.all}</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <button
        type="submit"
        className="rounded-base bg-primary hover:bg-primary-hover text-body-sm focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {frAdmin.members.apply}
      </button>
    </form>
  );
}
