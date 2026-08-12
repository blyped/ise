import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import { loadProfileSkills, type ProfileSkillRow } from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import { Badge, Card, ErrorBanner, Hint, LoadingView, PrimaryButton } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'Skills'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; rows: ProfileSkillRow[] };

/** ISE-022 — Mes compétences (niveau DÉCLARATIF, D-75). */
export function SkillsScreen({ navigation }: Props) {
  const profileId = useProfileId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadProfileSkills(profileId).then((result) => {
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

  if (state.status === 'loading') return <Screen><LoadingView /></Screen>;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorBanner title={pm.skills.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  const primaryCount = state.rows.filter((row) => row.isPrimary).length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>{pm.skills.heading}</Text>
        </View>
        <Text style={styles.count}>
          {state.rows.length} · {primaryCount} {pm.skills.primaryBadge.toLowerCase()}(s)
        </Text>

        {state.rows.length === 0 ? (
          <EmptyState title={pm.skills.emptyTitle} description={pm.skills.emptyBody} />
        ) : (
          state.rows.map((row) => (
            <Card key={row.skillId}>
              <View style={styles.row}>
                <View style={styles.textWrap}>
                  <Text style={styles.name}>
                    {row.isPrimary ? '★ ' : ''}
                    {row.name}
                  </Text>
                  {row.yearsExperience !== null ? (
                    <Text style={styles.meta}>{row.yearsExperience} ans</Text>
                  ) : null}
                </View>
                {row.level ? <Badge label={pm.skills.level[row.level]} tone="info" /> : null}
              </View>
              <Text style={styles.link} onPress={() => navigation.navigate('SkillForm', { skillId: row.skillId })}>
                {pm.skills.modify}
              </Text>
            </Card>
          ))
        )}

        <Hint>{pm.skills.hint}</Hint>

        <PrimaryButton label={pm.skills.addAction} onPress={() => navigation.navigate('SkillForm', undefined)} />
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textWrap: {
    gap: space[1],
  },
  name: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  meta: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  link: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
    marginTop: space[2],
  },
});
