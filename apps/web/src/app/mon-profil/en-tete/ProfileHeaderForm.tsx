'use client';

import { useActionState, useCallback } from 'react';
import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ErrorState,
  Field,
  Input,
  Select,
  Textarea,
  VisibilitySelect,
  type VisibilityLevelValue,
} from '@ise/ui-web';
import { profileHeaderSchema } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { initialFormState } from '@/lib/form-state';
import { useZodForm } from '@/lib/use-zod-form';
import type {
  CountryOption,
  OrganizationOption,
  VisibilityFieldRule,
} from '@/lib/queries/reference';
import type { ProfileHeader } from '@/lib/queries/profile-sections';
import { toHeaderInput } from '../form-input';
import { saveProfileHeaderAction } from '../actions';

const LINK_CLASS =
  'inline-flex min-h-[44px] items-center text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** Champs dont la visibilite est reglable depuis cet ecran (D-73). */
const VISIBILITY_FIELDS = [
  'headline',
  'bio',
  'current_position',
  'current_organization',
  'city',
  'country',
  'linkedin_url',
  'website_url',
] as const;

export interface ProfileHeaderFormProps {
  profile: ProfileHeader;
  countries: readonly CountryOption[];
  organizations: readonly OrganizationOption[];
  rules: readonly VisibilityFieldRule[];
  current: Readonly<Record<string, VisibilityLevelValue>>;
}

export function ProfileHeaderForm({
  profile,
  countries,
  organizations,
  rules,
  current,
}: ProfileHeaderFormProps) {
  const [state, formAction, isPending] = useActionState(saveProfileHeaderAction, initialFormState);
  const { clientErrors, clearField, onSubmit } = useZodForm(profileHeaderSchema, toHeaderInput);

  const errorFor = useCallback(
    (name: string): string | undefined => clientErrors[name] ?? state.fieldErrors[name],
    [clientErrors, state.fieldErrors],
  );

  const hasFieldErrors = Object.keys(state.fieldErrors).length > 0;
  const saveFailed = state.status === 'error' && !hasFieldErrors && state.correlationId !== null;

  const countryOptions = countries.map((country) => ({
    value: country.code,
    label: country.name,
  }));

  const organizationOptions = organizations.map((organization) => ({
    value: organization.id,
    label: organization.isVerified ? `${organization.name} ✓` : organization.name,
  }));

  const ruleFor = (fieldKey: string) => rules.find((rule) => rule.fieldKey === fieldKey);

  return (
    <form
      id="formulaire-profil-entete"
      action={formAction}
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-7"
    >
      {state.status === 'error' && hasFieldErrors && state.message ? (
        <Alert variant="error" title={state.message} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frProfile.header.identityTitle}</CardTitle>
        </CardHeader>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={frProfile.header.firstNameLabel} error={errorFor('firstName')} required>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                defaultValue={profile.firstName}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                onChange={() => clearField('firstName')}
              />
            )}
          </Field>

          <Field label={frProfile.header.lastNameLabel} error={errorFor('lastName')} required>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
                defaultValue={profile.lastName}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                onChange={() => clearField('lastName')}
              />
            )}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frProfile.header.headlineTitle}</CardTitle>
        </CardHeader>

        <div className="flex flex-col gap-5">
          <Field label={frProfile.header.headlineLabel} error={errorFor('headline')}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="headline"
                type="text"
                maxLength={200}
                defaultValue={profile.headline ?? ''}
                placeholder={frProfile.header.headlinePlaceholder}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                onChange={() => clearField('headline')}
              />
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={frProfile.header.organizationPickLabel}
              hint={frProfile.header.organizationPickHint}
              error={errorFor('currentOrganizationId')}
            >
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  name="currentOrganizationId"
                  options={organizationOptions}
                  placeholder={frProfile.header.organizationPickPlaceholder}
                  defaultValue={profile.currentOrganizationId ?? ''}
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={() => clearField('currentOrganizationId')}
                />
              )}
            </Field>

            <Field label={frProfile.header.positionLabel} error={errorFor('currentPosition')}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="currentPosition"
                  type="text"
                  defaultValue={profile.currentPosition ?? ''}
                  placeholder={frProfile.header.positionPlaceholder}
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={() => clearField('currentPosition')}
                />
              )}
            </Field>
          </div>

          <Field
            label={frProfile.header.organizationLabel}
            error={errorFor('currentOrganizationRaw')}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="currentOrganizationRaw"
                type="text"
                defaultValue={profile.currentOrganizationRaw ?? ''}
                placeholder={frProfile.header.organizationPlaceholder}
                aria-invalid={invalid}
                {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                onChange={() => clearField('currentOrganizationRaw')}
              />
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={frProfile.header.countryLabel} error={errorFor('currentCountryCode')}>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  name="currentCountryCode"
                  options={countryOptions}
                  placeholder={frProfile.header.countryPlaceholder}
                  defaultValue={profile.currentCountryCode ?? ''}
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={() => clearField('currentCountryCode')}
                />
              )}
            </Field>

            <Field label={frProfile.header.cityLabel} error={errorFor('currentCity')}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="currentCity"
                  type="text"
                  autoComplete="address-level2"
                  defaultValue={profile.currentCity ?? ''}
                  placeholder={frProfile.header.cityPlaceholder}
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={() => clearField('currentCity')}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={frProfile.header.linkedinLabel} error={errorFor('linkedinUrl')}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="linkedinUrl"
                  type="url"
                  inputMode="url"
                  defaultValue={profile.linkedinUrl ?? ''}
                  placeholder="https://www.linkedin.com/in/…"
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={() => clearField('linkedinUrl')}
                />
              )}
            </Field>

            <Field label={frProfile.header.websiteLabel} error={errorFor('websiteUrl')}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="websiteUrl"
                  type="url"
                  inputMode="url"
                  defaultValue={profile.websiteUrl ?? ''}
                  placeholder="https://…"
                  aria-invalid={invalid}
                  {...(describedBy ? { 'aria-describedby': describedBy } : {})}
                  onChange={() => clearField('websiteUrl')}
                />
              )}
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frProfile.header.aboutTitle}</CardTitle>
        </CardHeader>
        <Field label={frProfile.header.aboutLabel} error={errorFor('bio')}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              name="bio"
              rows={7}
              maxLength={2000}
              defaultValue={profile.bio ?? ''}
              placeholder={frProfile.header.aboutPlaceholder}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              onChange={() => clearField('bio')}
            />
          )}
        </Field>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frProfile.header.visibilityTitle}</CardTitle>
        </CardHeader>
        <p className="text-body-sm text-text-secondary mb-5">{frProfile.header.visibilityHint}</p>

        <div className="grid gap-5 sm:grid-cols-2">
          {VISIBILITY_FIELDS.map((fieldKey) => {
            const rule = ruleFor(fieldKey);
            if (!rule) return null;
            return (
              <VisibilitySelect
                key={fieldKey}
                name={`visibility.${fieldKey}`}
                label={rule.label}
                labels={frProfile.visibility}
                allowedLevels={rule.allowedLevels}
                defaultValue={current[fieldKey] ?? rule.defaultVisibility}
              />
            );
          })}
        </div>
      </Card>

      {saveFailed && state.correlationId !== null ? (
        <ErrorState
          title={frProfile.common.saveErrorTitle}
          correlationId={state.correlationId}
          {...(state.message ? { description: state.message } : {})}
        />
      ) : null}

      <div className="border-border flex flex-wrap items-center gap-5 border-t pt-6">
        <Button
          type="submit"
          size="lg"
          loading={isPending}
          loadingLabel={frProfile.common.savePending}
        >
          {frProfile.common.save}
        </Button>
        <Link href={PROFILE_ROUTES.overview} className={LINK_CLASS}>
          {frProfile.common.cancel}
        </Link>
      </div>
    </form>
  );
}
