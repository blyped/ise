import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frInternships } from '@/i18n/internships';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { INTERNSHIP_ROUTES } from '@/lib/routes/internships';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadInternshipHome } from '@/lib/queries/internships';
import { loadCountries, loadSectors } from '@/lib/queries/reference';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  FormRow,
  INPUT,
  PRIMARY_BUTTON,
  PageHeader,
  SELECT,
  TEXTAREA,
} from '@/components/collaborate/CollaborateUI';
import { saveNeedAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frInternships.preferences.title };

const SUCCESS: Record<string, string> = { need_saved: frInternships.preferences.done };

/** ISE-072, volet « Ma recherche de stage » : le besoin qui alimente le matching. */
export default async function InternshipNeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const feedback = readFeedback(await searchParams);
  const correlationId = newCorrelationId();
  const [viewer, home, countries, sectors] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadInternshipHome(correlationId),
    loadCountries(correlationId),
    loadSectors(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={PROMOTION_ROUTES.hub}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!home.ok) {
    return shell(
      home.error.code === 'not_authorized' ? (
        <EmptyState
          title={frInternships.common.studentsOnlyTitle}
          description={frInternships.common.studentsOnlyBody}
        />
      ) : (
        <ErrorState
          title={frInternships.common.loadErrorTitle}
          description={home.error.userMessage}
          correlationId={correlationId}
        />
      ),
    );
  }

  const need = home.data.need;

  return shell(
    <div className="flex flex-col gap-8">
      <Breadcrumb
        label={frInternships.common.breadcrumb}
        items={[
          { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
          { label: frPromotions.hub.internshipsTitle, href: INTERNSHIP_ROUTES.home },
          { label: frInternships.preferences.title, href: null },
        ]}
      />

      <PageHeader
        title={frInternships.preferences.title}
        subtitle={frInternships.preferences.subtitle}
      />

      <FeedbackBanner feedback={feedback} catalog={frInternships.errors} successCatalog={SUCCESS} />

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frInternships.preferences.title}</CardTitle>
        </CardHeader>
        <form action={saveNeedAction} className="flex flex-col gap-5">
          <FormRow id="type-stage" label={frInternships.preferences.type}>
            <select
              id="type-stage"
              name="internshipType"
              defaultValue={need?.internshipType ?? 'academic'}
              className={SELECT}
            >
              <option value="academic">{frInternships.preferences.typeAcademic}</option>
              <option value="final_year">{frInternships.preferences.typeFinalYear}</option>
              <option value="pre_employment">{frInternships.preferences.typePreEmployment}</option>
              <option value="research">{frInternships.preferences.typeResearch}</option>
              <option value="other">{frInternships.preferences.typeOther}</option>
            </select>
          </FormRow>

          <FormRow
            id="objectif-stage"
            label={frInternships.preferences.objective}
            hint={frInternships.preferences.objectiveHelp}
          >
            <textarea
              id="objectif-stage"
              name="objective"
              maxLength={500}
              defaultValue={need?.objective ?? ''}
              className={TEXTAREA}
              aria-describedby="objectif-stage-aide"
            />
          </FormRow>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormRow id="debut-stage" label={frInternships.preferences.startDate}>
              <input
                id="debut-stage"
                name="startDate"
                type="date"
                defaultValue={need?.startDate ?? ''}
                className={INPUT}
              />
            </FormRow>
            <FormRow id="fin-stage" label={frInternships.preferences.endDate}>
              <input
                id="fin-stage"
                name="endDate"
                type="date"
                defaultValue={need?.endDate ?? ''}
                className={INPUT}
              />
            </FormRow>
          </div>

          <label className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3">
            <input
              type="checkbox"
              name="datesFlexible"
              defaultChecked={need?.datesFlexible ?? false}
            />
            {frInternships.preferences.datesFlexible}
          </label>

          <FormRow id="mode-stage" label={frInternships.preferences.workMode}>
            <select
              id="mode-stage"
              name="workMode"
              defaultValue={need?.workMode ?? 'on_site'}
              className={SELECT}
            >
              <option value="on_site">{frInternships.preferences.workModeOnSite}</option>
              <option value="hybrid">{frInternships.preferences.workModeHybrid}</option>
              <option value="remote">{frInternships.preferences.workModeRemote}</option>
            </select>
          </FormRow>

          <label className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3">
            <input
              type="checkbox"
              name="remoteAllowed"
              defaultChecked={need?.remoteAllowed ?? false}
            />
            {frInternships.preferences.remoteAllowed}
          </label>

          <FormRow id="mobilite-stage" label={frInternships.preferences.mobility}>
            <select
              id="mobilite-stage"
              name="mobility"
              defaultValue={need?.mobilityInternational ?? 'no'}
              className={SELECT}
            >
              <option value="no">{frInternships.preferences.mobilityNo}</option>
              <option value="yes">{frInternships.preferences.mobilityYes}</option>
              <option value="conditional">{frInternships.preferences.mobilityConditional}</option>
            </select>
          </FormRow>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-body-sm text-text-primary font-medium">
              {frInternships.preferences.sectors}
            </legend>
            <p className="text-caption text-text-secondary">
              {frInternships.preferences.sectorsHelp}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(sectors.ok ? sectors.data : []).slice(0, 12).map((sector) => (
                <label
                  key={sector.id}
                  className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
                >
                  <input
                    type="checkbox"
                    name="sectorIds"
                    value={String(sector.id)}
                    defaultChecked={need?.sectors.some((s) => s.sectorId === sector.id) ?? false}
                  />
                  {sector.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-body-sm text-text-primary font-medium">
              {frInternships.preferences.countries}
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(countries.ok ? countries.data : []).slice(0, 12).map((country) => (
                <label
                  key={country.code}
                  className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
                >
                  <input
                    type="checkbox"
                    name="countryCodes"
                    value={country.code}
                    defaultChecked={
                      need?.countries.some((c) => c.countryCode === country.code) ?? false
                    }
                  />
                  {country.name}
                </label>
              ))}
            </div>
          </fieldset>

          <FormRow id="visibilite-stage" label={frInternships.preferences.visibility}>
            <select
              id="visibilite-stage"
              name="visibility"
              defaultValue={need?.visibility ?? 'internship_managers_and_relevant_alumni'}
              className={SELECT}
            >
              <option value="internship_managers_and_relevant_alumni">
                {frInternships.preferences.visibilityManagers}
              </option>
              <option value="verified_members">
                {frInternships.preferences.visibilityVerified}
              </option>
            </select>
          </FormRow>

          <FormRow id="statut-stage" label={frInternships.preferences.status}>
            <select
              id="statut-stage"
              name="status"
              defaultValue={need?.status ?? 'active'}
              className={SELECT}
            >
              <option value="active">{frInternships.preferences.statusActive}</option>
              <option value="paused">{frInternships.preferences.statusPaused}</option>
              <option value="draft">{frInternships.preferences.statusDraft}</option>
            </select>
          </FormRow>

          <p>
            <button type="submit" className={PRIMARY_BUTTON}>
              {frInternships.preferences.submit}
            </button>
          </p>
        </form>
      </Card>
    </div>,
  );
}
