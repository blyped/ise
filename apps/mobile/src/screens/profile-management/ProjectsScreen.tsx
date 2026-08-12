import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import { deleteProject, loadProjects, type ProjectRow } from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import { Card, ErrorBanner, Hint, LoadingView, PrimaryButton, yearOf } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'Projects'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; rows: ProjectRow[] };

/** ISE-025 — Mes projets & réalisations. */
export function ProjectsScreen({ navigation }: Props) {
  const profileId = useProfileId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadProjects(profileId).then((result) => {
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

  function confirmDelete(row: ProjectRow) {
    Alert.alert(pm.common.delete, row.title, [
      { text: pm.common.cancel, style: 'cancel' },
      {
        text: pm.common.delete,
        style: 'destructive',
        onPress: () => {
          deleteProject(profileId, row.id).then((result) => {
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
        <ErrorBanner title={pm.projects.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{pm.projects.heading}</Text>
        <Text style={styles.count}>
          {state.rows.length} · {pm.projects.title}
        </Text>

        {state.rows.length === 0 ? (
          <EmptyState title={pm.projects.emptyTitle} description={pm.projects.emptyBody} />
        ) : (
          state.rows.map((row) => (
            <Card key={row.id}>
              <Text style={styles.year}>{yearOf(row.startDate)}</Text>
              <Text style={styles.title}>{row.title}</Text>
              {row.organizationNameRaw ? <Text style={styles.organization}>{row.organizationNameRaw}</Text> : null}
              {row.role ? <Text style={styles.meta}>{row.role}</Text> : null}
              {row.outcome ? (
                <View style={styles.outcomePill}>
                  <Text style={styles.outcomeLabel}>{pm.projectForm.outcomeLabel} : {row.outcome}</Text>
                </View>
              ) : null}
              <View style={styles.actionsRow}>
                <Text style={styles.link} onPress={() => navigation.navigate('ProjectForm', { projectId: row.id })}>
                  {pm.common.edit}
                </Text>
                <Text style={styles.linkDanger} onPress={() => confirmDelete(row)}>
                  {pm.common.delete}
                </Text>
              </View>
            </Card>
          ))
        )}

        <Hint tone="warning">{pm.projects.hint}</Hint>

        <PrimaryButton label={pm.projects.addAction} onPress={() => navigation.navigate('ProjectForm', undefined)} />
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
  year: {
    ...textStyle.caption,
    color: colors.actionBlue,
    fontWeight: '700',
  },
  title: {
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
  outcomePill: {
    backgroundColor: '#EAF7EF',
    borderRadius: 10,
    padding: space[3],
  },
  outcomeLabel: {
    ...textStyle.caption,
    color: colors.success,
    fontWeight: '600',
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
