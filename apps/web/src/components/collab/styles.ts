/**
 * Classes partagees par les tranches COMMUNAUTES, PROJETS et
 * ACTUALITES & EVENEMENTS.
 *
 * Elles reprennent a l'identique les valeurs deja utilisees par les
 * tranches APPELS et OPPORTUNITES : hauteur de cible 44 px
 * (accessibilite), focus toujours visible, rayon de base, jetons de
 * couleur du design system. Aucune couleur dediee par module (D-90).
 */
export const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export const PRIMARY_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export const PRIMARY_BUTTON = PRIMARY_LINK;

export const SECONDARY_BUTTON = ACTION_LINK;

export const FIELD =
  'h-[44px] w-full min-w-0 rounded-base border border-[#CBD5E1] bg-surface px-4 text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export const TEXTAREA =
  'w-full min-w-0 rounded-base border border-[#CBD5E1] bg-surface px-4 py-3 text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export const SELECT =
  'h-[44px] w-full rounded-base border border-[#CBD5E1] bg-surface px-3 text-body-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export const TAB_BASE =
  'inline-flex min-h-[44px] items-center border-b-2 px-4 text-body-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export const TAB_CURRENT = 'border-primary text-primary font-semibold';

export const TAB_IDLE = 'border-transparent text-text-secondary hover:text-text-primary';

export const CHIP =
  'inline-flex items-center rounded-full border border-border bg-surface-muted px-3 py-[3px] text-caption text-text-secondary';
