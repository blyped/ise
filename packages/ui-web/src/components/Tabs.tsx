'use client';

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../utils/cx';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  /** Nom du jeu d'onglets, annonce aux lecteurs d'ecran. */
  ariaLabel: string;
  items: readonly TabItem[];
  defaultTabId?: string;
  className?: string;
}

/** Onglets soulignes, navigation clavier fleches / Origine / Fin. */
export function Tabs({ ariaLabel, items, defaultTabId, className }: TabsProps) {
  const base = useId();
  const first = items[0];
  const [active, setActive] = useState<string>(defaultTabId ?? first?.id ?? '');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (items.length === 0) return null;

  const enabled = items.filter((item) => item.disabled !== true);

  function focusTab(id: string) {
    setActive(id);
    tabRefs.current[id]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = enabled.findIndex((item) => item.id === active);
    if (index < 0) return;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % enabled.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + enabled.length) % enabled.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = enabled.length - 1;
    if (next === null) return;
    event.preventDefault();
    const target = enabled[next];
    if (target) focusTab(target.id);
  }

  return (
    <div className={cx('flex flex-col gap-5', className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="border-border flex gap-1 overflow-x-auto border-b"
      >
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[item.id] = node;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.id}`}
              aria-controls={`${base}-panel-${item.id}`}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              disabled={item.disabled === true}
              onClick={() => setActive(item.id)}
              onKeyDown={onKeyDown}
              className={cx(
                'text-body-sm whitespace-nowrap border-b-2 px-5 py-4 font-medium transition-colors duration-150',
                'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-[-2px]',
                'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60',
                selected
                  ? 'border-primary text-primary-hover'
                  : 'text-text-secondary hover:text-text-primary border-transparent hover:border-[#CBD5E1]',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={item.id !== active}
          tabIndex={0}
          className="focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {item.id === active ? item.content : null}
        </div>
      ))}
    </div>
  );
}
