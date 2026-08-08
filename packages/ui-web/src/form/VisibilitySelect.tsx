'use client';

import { Field } from '../components/Field';
import { Select } from '../components/Select';

/** Les 4 niveaux de l'echelle unifiee (D-73). Aucun niveau « web public ». */
export type VisibilityLevelValue = 'private' | 'connections' | 'promotion' | 'members';

export interface VisibilitySelectProps {
  name: string;
  label: string;
  hint?: string;
  /** Libelles traduits, fournis par l'application (ui-web ne porte aucune chaine metier). */
  labels: Readonly<Record<VisibilityLevelValue, string>>;
  /**
   * Niveaux reellement autorises pour ce champ. Ils viennent de
   * `profile_visibility_defaults.allowed_levels` : proposer « tous les
   * membres » sur un telephone serait une promesse que la base refuse.
   */
  allowedLevels: readonly VisibilityLevelValue[];
  defaultValue: VisibilityLevelValue;
  error?: string | undefined;
  disabled?: boolean;
  onChange?: () => void;
}

/**
 * Choix de visibilite d'un champ de profil (D-73).
 * Le composant n'invente aucun niveau : il n'affiche que ceux que la base
 * declare autorises.
 */
export function VisibilitySelect({
  name,
  label,
  hint,
  labels,
  allowedLevels,
  defaultValue,
  error,
  disabled = false,
  onChange,
}: VisibilitySelectProps) {
  const options = allowedLevels.map((level) => ({ value: level, label: labels[level] }));
  const value = allowedLevels.includes(defaultValue)
    ? defaultValue
    : (allowedLevels[0] ?? 'private');

  return (
    <Field label={label} {...(hint ? { hint } : {})} error={error}>
      {({ id, describedBy, invalid }) => (
        <Select
          id={id}
          name={name}
          options={options}
          defaultValue={value}
          disabled={disabled}
          aria-invalid={invalid}
          {...(describedBy ? { 'aria-describedby': describedBy } : {})}
          {...(onChange ? { onChange } : {})}
        />
      )}
    </Field>
  );
}
