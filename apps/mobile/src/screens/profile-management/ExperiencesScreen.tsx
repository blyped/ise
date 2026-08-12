import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  deleteExperience,
  loadExperiences,
  type ExperienceRow,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import { Card, ErrorBanner, Hint, LoadingView, PrimaryButton, yearOf } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'Experiences'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; rows: ExperienceRow[] };

/** ISE-018 — Mes expériences. */
export function ExperiencesScreen({ navigation }: Props) {
  const profileId = useProfileId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadExperiences(profileId).then((result) => {
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

  function confirmDelete(row: ExperienceRow) {
    Alert.alert(pm.experiences.deleteConfirmTitle, row.positionTitle, [
      { text: pm.common.cancel, style: 'cancel' },
      {
        text: pm.common.delete,
        style: 'destructive',
        onPress: () => {
          deleteExperience(profileId, row.id).then((result) => {
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
        <ErrorBanner title={pm.experiences.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <View style={styles.headingText}>
            <Text style={styles.heading}>{pm.experiences.heading}</Text>
            <Text style={styles.count}>
              {state.rows.length} · {pm.experiences.title}
            </Text>
          </View>
        </View>

        {state.rows.length === 0 ? (
          <EmptyState title={pm.experiences.emptyTitle} description={pm.experiences.emptyBody} />
        ) : (
          state.rows.map((row) => (
            <Card key={row.id}>
              <Text style={styles.period}>
                {yearOf(row.startDate)} — {row.isCurrent ? pm.experiences.current : yearOf(row.endDate)}
              </Text>
              <Text style={styles.position}>{row.positionTitle}</Text>
              <Text style={styles.organization}>{row.organizationName}</Text>
              {row.city || row.sectorName ? (
                <Text style={styles.meta}>{[row.city, row.sectorName].filter(Boolean).join(' · ')}</Text>
              ) : null}
              <View style={styles.actionsRow}>
                <Text
                  style={styles.link}
                  onPress={() => navigation.navigate('ExperienceForm', { experienceId: row.id })}
                >
                  {pm.common.edit}
                </Text>
                <Text style={styles.linkDanger} onPress={() => confirmDelete(row)}>
                  {pm.common.delete}
                </Text>
              </View>
            </Card>
          ))
        )}

        <Hint>{pm.experiences.hint}</Hint>

        <PrimaryButton label={pm.experiences.addAction} onPress={() => navigation.navigate('ExperienceForm', undefined)} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space[4],
    paddingBottom: space[8],
  },
  headingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headingText: {
    gap: space[1],
  },
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  count: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  period: {
    ...textStyle.caption,
    color: colors.actionBlue,
    fontWeight: '700',
  },
  position: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  organization: {
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
