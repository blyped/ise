import Link from 'next/link';
import type { ReactNode } from 'react';
import { frCms } from '@/i18n/cms';

const PRIMARY_LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base bg-primary px-6 ' +
  'text-body-sm font-semibold text-white hover:bg-primary-hover ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export interface PageHeaderProps {
  title: string;
  subtitle: string;
  action?: { href: string; label: string } | undefined;
  children?: ReactNode;
}

/** En-tete commun aux dix ecrans : titre, sous-titre, action principale. */
export function PageHeader({ title, subtitle, action, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{title}</h1>
        <p className="text-body text-text-secondary max-w-[62ch]">{subtitle}</p>
      </div>
      {action !== undefined ? (
        <Link href={action.href} className={PRIMARY_LINK}>
          {action.label}
        </Link>
      ) : null}
      {children}
    </div>
  );
}

export interface SearchFieldProps {
  action: string;
  placeholder?: string;
  defaultValue?: string | undefined;
  /** Champs a conserver dans l'URL lors d'une recherche. */
  hidden?: Readonly<Record<string, string>>;
}

/**
 * Champ de recherche des maquettes. Formulaire `GET` : la recherche est
 * dans l'URL, donc partageable, rechargeable et fonctionnelle sans
 * JavaScript.
 */
export function SearchField({ action, placeholder, defaultValue, hidden }: SearchFieldProps) {
  return (
    <form method="get" action={action} className="flex gap-3" role="search">
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <label htmlFor="cms-recherche" className="sr-only">
        {frCms.common.searchLabel}
      </label>
      <input
        id="cms-recherche"
        name="recherche"
        type="search"
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder ?? frCms.common.search}
        className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue h-[44px] min-w-0 flex-1 border border-[#CBD5E1] px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      <button
        type="submit"
        className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {frCms.common.submitSearch}
      </button>
    </form>
  );
}
