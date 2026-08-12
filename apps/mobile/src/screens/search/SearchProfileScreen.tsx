import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frSearch } from '../../i18n/search';
import { newCorrelationId } from '../../lib/correlation';
import { loadMemberProfile, type MemberProfileView } from '../../lib/queries/search';
import type { SearchStackParamList } from '../../navigation/SearchStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'not-found' }
  | { status: 'ready'; profile: MemberProfileView };

type Props = NativeStackScreenProps<SearchStackParamList, 'SearchProfile'>;

/** Champs que l'ecran sait afficher (meme liste que `EXPECTED_FIELDS` cote web). */
const EXPECTED_FIELDS = [
  'headline',
  'bio',
  'current_position',
  'current_organization',
  'country',
  'city',
  'promotion',
  'skills',
  'sectors',
  'languages',
  'experiences',
  'availabilities',
] as const;

/**
 * ISE-037 — Profil d'un autre ISE.
 *
 * Une seule lecture, `get_member_profile(uuid)` : un champ non autorise
 * par le proprietaire est ABSENT de la reponse (jamais recu puis masque,
 * MASTER PROMPT §47). `visibleFields` dit ce qui a ete autorise.
 *
 * E-06 : pas d'onglets — sections empilees ; les blocs sans donnee
 * visible ne sont pas rendus (Formations, Promotion), les autres
 * affichent un texte de substitution honnete plutot que de disparaitre
 * (A propos, Compétences, Parcours, Disponibilite, Relation) — meme
 * comportement que `apps/web/src/app/profil/[profileId]/page.tsx`.
 *
 * E-05 : « Se connecter » / « Voir les chemins d'introduction » relevent
 * du lot mobile Relations (ISE-038 -> ISE-046), developpe en parallele.
 * Cet ecran n'en fabrique pas la mecanique — voir `i18n/search.ts`.
 */
export function SearchProfileScreen({ route }: Props) {
  const { profileId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadMemberProfile(profileId)
      .then((result) => {
        if (result.failed) {
          setState({ status: 'error', correlationId: newCorrelationId() });
        } else if (result.profile === null) {
          setState({ status: 'not-found' });
        } else {
          setState({ status: 'ready', profile: result.profile });
        }
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorState title={frSearch.profile.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  if (state.status === 'not-found') {
    return (
      <Screen>
        <EmptyState title={frSearch.profile.notFoundTitle} description={frSearch.profile.notFoundBody} />
      </Screen>
    );
  }

  const { profile } = state;
  const visible = new Set(profile.visibleFields);
  const restricted = EXPECTED_FIELDS.filter((field) => !visible.has(field));

  const identityLine = [
    profile.promotion?.label ?? null,
    [profile.currentCity, profile.currentCountry].filter((part) => part !== null).join(', ') || null,
  ]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' · ');

  const positionLine = [profile.currentPosition, profile.currentOrganization]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{initials(profile.displayName)}</Text>
          </View>
          <Text style={styles.name}>{profile.displayName}</Text>
          <View style={styles.statusRow}>
            {profile.verificationStatus === 'verified' ? (
              <Badge tone="success" label={frSearch.profile.verified} />
            ) : (
              <Badge tone="neutral" label={frSearch.profile.unverified} />
            )}
            {profile.claimStatus === 'unclaimed' ? (
              <Badge tone="neutral" label={frSearch.profile.referenced} />
            ) : null}
          </View>
          {identityLine.length > 0 ? <Text style={styles.identity}>{identityLine}</Text> : null}
          {positionLine.length > 0 ? <Text style={styles.position}>{positionLine}</Text> : null}
          {profile.headline ? <Text style={styles.headline}>{profile.headline}</Text> : null}
        </View>

        <Section title={frSearch.profile.aboutTitle}>
          <Text style={styles.bodyText}>{profile.bio ?? frSearch.profile.aboutEmpty}</Text>
        </Section>

        <Section title={frSearch.profile.relationTitle}>
          <RelationBody profile={profile} />
          <Text style={styles.hint}>{frSearch.profile.relationSource}</Text>
        </Section>

        <Section title={frSearch.profile.availabilityTitle}>
          {profile.availabilities.length === 0 ? (
            <Text style={styles.bodyText}>{frSearch.profile.availabilityEmpty}</Text>
          ) : (
            <View style={styles.chipRow}>
              {profile.availabilities.map((availability) => (
                <View key={availability.code} style={styles.availabilityChip}>
                  <Text style={styles.availabilityChipLabel}>{availability.name}</Text>
                </View>
              ))}
            </View>
          )}
        </Section>

        <Section title={frSearch.profile.skillsTitle}>
          {profile.skills.length === 0 ? (
            <Text style={styles.bodyText}>{frSearch.profile.skillsEmpty}</Text>
          ) : (
            <>
              {profile.skills.map((skill) => (
                <View key={skill.id} style={styles.row}>
                  <Text style={styles.rowLabel}>{skill.name}</Text>
                  <Text style={styles.rowValue}>
                    {skill.level !== null ? frSearch.profile.skillLevel[skill.level] : frSearch.profile.skillLevel.undeclared}
                    {skill.yearsExperience !== null
                      ? ` · ${frSearch.profile.skillYears.replace('{years}', String(skill.yearsExperience))}`
                      : ''}
                  </Text>
                </View>
              ))}
              <Text style={styles.hint}>{frSearch.profile.skillsDeclarative}</Text>
            </>
          )}
        </Section>

        <Section title={frSearch.profile.experiencesTitle}>
          {profile.experiences.length === 0 ? (
            <Text style={styles.bodyText}>{frSearch.profile.experiencesEmpty}</Text>
          ) : (
            profile.experiences.map((experience) => (
              <View key={experience.id} style={styles.experienceItem}>
                <Text style={styles.rowLabel}>{experience.positionTitle}</Text>
                {experience.organization ? <Text style={styles.rowValue}>{experience.organization}</Text> : null}
                <Text style={styles.hint}>
                  {formatPeriod(experience.startDate, experience.endDate, experience.isCurrent)}
                  {[experience.city, experience.country].filter((part) => part !== null).length > 0
                    ? ` · ${[experience.city, experience.country].filter((part) => part !== null).join(', ')}`
                    : ''}
                </Text>
              </View>
            ))
          )}
        </Section>

        {profile.educations.length > 0 ? (
          <Section title={frSearch.profile.educationsTitle}>
            {profile.educations.map((education) => (
              <View key={education.id} style={styles.experienceItem}>
                <Text style={styles.rowLabel}>{education.institution}</Text>
                {education.degree ? <Text style={styles.rowValue}>{education.degree}</Text> : null}
                {education.fieldOfStudy ? <Text style={styles.hint}>{education.fieldOfStudy}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {profile.promotion !== null ? (
          <Section title={frSearch.profile.promotionTitle}>
            <Text style={styles.bodyText}>{profile.promotion.label}</Text>
          </Section>
        ) : null}

        {profile.sectors.length > 0 || profile.languages.length > 0 || profile.linkedinUrl || profile.websiteUrl ? (
          <Section title={frSearch.profile.keyFactsTitle}>
            {profile.sectors.length > 0 ? (
              <KeyFact label={frSearch.profile.keyFactSectors} value={profile.sectors.map((s) => s.name).join(', ')} />
            ) : null}
            {profile.languages.length > 0 ? (
              <KeyFact
                label={frSearch.profile.keyFactLanguages}
                value={profile.languages.map((l) => l.name).join(', ')}
              />
            ) : null}
            {profile.linkedinUrl ? (
              <Pressable onPress={() => Linking.openURL(profile.linkedinUrl as string)}>
                <KeyFact label={frSearch.profile.keyFactLinkedin} value={profile.linkedinUrl} link />
              </Pressable>
            ) : null}
            {profile.websiteUrl ? (
              <Pressable onPress={() => Linking.openURL(profile.websiteUrl as string)}>
                <KeyFact label={frSearch.profile.keyFactWebsite} value={profile.websiteUrl} link />
              </Pressable>
            ) : null}
          </Section>
        ) : null}

        {restricted.length > 0 ? (
          <View style={styles.hiddenBox}>
            <Text style={styles.hiddenTitle}>{frSearch.profile.hiddenFieldsTitle}</Text>
            <Text style={styles.hiddenBody}>{frSearch.profile.hiddenFieldsBody}</Text>
          </View>
        ) : null}

        {!profile.isSelf ? (
          <Section title={frSearch.profile.actionsTitle}>
            <Text style={styles.bodyText}>{frSearch.profile.actionsUnavailable}</Text>
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function RelationBody({ profile }: { profile: MemberProfileView }) {
  if (profile.isSelf) {
    return <Text style={styles.bodyText}>{frSearch.profile.relationSelf}</Text>;
  }

  const items: string[] = [];
  if (profile.relationship.isConnected) items.push(frSearch.profile.relationConnected);
  if (profile.relationship.sharesPromotion && profile.promotion !== null) {
    items.push(frSearch.profile.relationPromotion.replace('{promotion}', profile.promotion.label));
  }
  if (profile.relationship.sharesOrganization) {
    items.push(
      frSearch.profile.relationOrganization.replace(
        '{organization}',
        profile.relationship.sharedOrganizationName ?? profile.currentOrganization ?? '',
      ),
    );
  }
  if (profile.relationship.mutualConnectionCount === 1) {
    items.push(frSearch.profile.relationMutualOne);
  } else if (profile.relationship.mutualConnectionCount > 1) {
    items.push(
      frSearch.profile.relationMutualMany.replace('{count}', String(profile.relationship.mutualConnectionCount)),
    );
  }

  if (items.length === 0) {
    return <Text style={styles.bodyText}>{frSearch.profile.relationNone}</Text>;
  }

  return (
    <>
      {items.map((item) => (
        <Text key={item} style={styles.bodyText}>
          · {item}
        </Text>
      ))}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Badge({ tone, label }: { tone: 'success' | 'neutral'; label: string }) {
  return (
    <View style={[styles.badge, tone === 'success' ? styles.badgeSuccess : styles.badgeNeutral]}>
      <Text style={[styles.badgeLabel, tone === 'success' ? styles.badgeLabelInverse : null]}>{label}</Text>
    </View>
  );
}

function KeyFact({ label, value, link = false }: { label: string; value: string; link?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, link ? styles.rowValueLink : null]}>{value}</Text>
    </View>
  );
}

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase();
}

function formatPeriod(start: string | null, end: string | null, current: boolean): string {
  const year = (value: string | null) => (value ? value.slice(0, 4) : '');
  const from = year(start);
  const to = current ? frSearch.profile.experienceCurrent : year(end);
  if (from === '' && to === '') return '';
  return frSearch.profile.experiencePeriod.replace('{start}', from).replace('{end}', to);
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: space[8],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: space[6],
    gap: space[2],
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  avatarLabel: {
    ...textStyle.h3,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  name: {
    ...textStyle.h3,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  identity: {
    ...textStyle.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  position: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  headline: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  badge: {
    borderRadius: rounded.full,
    paddingHorizontal: space[3],
    paddingVertical: 2,
  },
  badgeSuccess: {
    backgroundColor: colors.success,
  },
  badgeNeutral: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeLabel: {
    ...textStyle.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  badgeLabelInverse: {
    color: colors.textInverse,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    marginBottom: space[4],
    gap: space[2],
  },
  sectionTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: space[1],
  },
  bodyText: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  hint: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  availabilityChip: {
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  availabilityChipLabel: {
    ...textStyle.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[3],
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  rowValue: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
    flexShrink: 1,
    textAlign: 'right',
  },
  rowValueLink: {
    color: colors.actionBlue,
  },
  experienceItem: {
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  hiddenBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: space[4],
    marginBottom: space[4],
    gap: space[1],
  },
  hiddenTitle: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  hiddenBody: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
});
