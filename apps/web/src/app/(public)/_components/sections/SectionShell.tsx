import type { ReactNode } from 'react';
import { cx } from '@ise/ui-web';

/**
 * Enveloppe commune des sections de PUB-001.
 *
 * La largeur, la gouttiere et les ruptures suivent D-96 : 1160 px de contenu
 * maximum, gouttiere 24 px au-dessus de 1024 px et 16 px en dessous.
 */
export function SectionShell({
  id,
  title,
  headingLevel = 'h2',
  className,
  children,
}: {
  id?: string;
  title?: string;
  headingLevel?: 'h2' | 'h3';
  className?: string;
  children: ReactNode;
}) {
  const Heading = headingLevel;

  return (
    <section
      id={id}
      className={cx('mx-auto w-full max-w-[var(--layout-content-max)] px-7 max-md:px-5', className)}
    >
      {title ? (
        <Heading className="text-h2 text-text-primary max-md:text-h3 mb-7 font-bold max-md:mb-5">
          {title}
        </Heading>
      ) : null}
      {children}
    </section>
  );
}
