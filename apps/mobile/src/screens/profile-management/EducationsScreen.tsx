import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  deleteEducation,
  loadEducations,
  type EducationRow,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import { Badge, Card, ErrorBanner, Hint, LoadingView, PrimaryButton } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'Educations'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; rows: EducationRow[] };

/** ISE-020 — Mes formations (diplômes + certifications). */
export function EducationsScreen({ navigation }: Props) {
  const profileId = useProfileId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadEducations(profileId).then((result) => {
      if (!result.ok) {
        setState({ status: 'error', correlationId: result.correlationId });
        return;
      }
      setState({ status: 'ready', rows: result.data });
    });
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  function confirmDelete(row: EducationRow) {
    Alert.alert(pm.common.delete, row.degree ?? row.institution, [
      { text: pm.common.cancel, style: 'cancel' },
      {
        text: pm.common.delete,
        style: 'destructive',
        onPress: () => {
          deleteEducation(profileId, row.id).then((result) => {
            if (result.ok) load();
          });
        },
      },
    ]);
  }

  if (state.status === 'loading') return <Screen><LoadingView /></Screen>;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorBanner title={pm.educations.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  const academic = state.rows.filter((row) => row.educationType === 'academic');
  const certifications = state.rows.filter((row) => row.educationType === 'certification');

  function renderRow(row: EducationRow) {
    return (
      <Card key={row.id}>
        <View style={styles.rowHeader}>
          <Text style={styles.year}>{row.endYear ?? row.startYear ?? '—'}</Text>
          {row.educationType === 'certification' ? <Badge label={pm.educations.certificationBadge} tone="success" /> : null}
        </View>
        <Text style={styles.degree}>{row.degree ?? row.fieldOfStudy ?? row.institution}</Text>
        <Text style={styles.institution}>{row.institution}</Text>
        {row.city ? <Text style={styles.meta}>{row.city}</Text> : null}
        <View style={styles.actionsRow}>
          <Text style={styles.link} onPress={() => navigation.navigate('EducationForm', { educationId: row.id })}>
            {pm.common.edit}
          </Text>
          <Text style={styles.linkDanger} onPress={() => confirmDelete(row)}>
            {pm.common.delete}
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{pm.educations.heading}</Text>
        <Text style={styles.count}>
          {state.rows.length} · {pm.educations.title}
        </Text>

        {state.rows.length === 0 ? (
          <EmptyState title={pm.educations.emptyTitle} description={pm.educations.emptyBody} />
        ) : (
          <>
            {academic.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>{pm.educations.academicSection}</Text>
                {academic.map(renderRow)}
              </>
            ) : null}
            {certifications.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>{pm.educations.certificationSection}</Text>
                {certifications.map(renderRow)}
              </>
            ) : null}
          </>
        )}

        <Hint tone="warning">{pm.educations.hint}</Hint>

        <PrimaryButton label={pm.educations.addAction} onPress={() => navigation.navigate('EducationForm', undefined)} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space[4],
    paddingBottom: space[8],
  },
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  count: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
    marginTop: -space[2],
  },
  sectionLabel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: space[2],
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  year: {
    ...textStyle.caption,
    color: colors.actionBlue,
    fontWeight: '700',
  },
  degree: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  institution: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  meta: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space[5],
    marginTop: space[2],
  },
  link: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  linkDanger: {
    ...textStyle.bodySm,
    color: colors.error,
    fontWeight: '600',
  },
});
