import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  availabilityNeedsRefresh,
  loadAvailabilityDetails,
  type AvailabilityDetail,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Badge, Card, ErrorBanner, Hint, LoadingView, PrimaryButton } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'Availability'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; rows: AvailabilityDetail[] };

/** Étiquette d'intensité déclarative — dérivée du nombre de formes d'aide actives (aucune colonne dédiée). */
function levelLabel(activeCount: number): string {
  if (activeCount === 0) return 'Aucune';
  if (activeCount <= 2) return 'Faible';
  if (activeCount <= 4) return 'Modérée';
  return 'Élevée';
}

/** ISE-032 — Ma disponibilité (lecture). */
export function AvailabilityScreen({ navigation }: Props) {
  const profileId = useProfileId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadAvailabilityDetails(profileId).then((result) => {
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
        <ErrorBanner title={pm.availability.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  const activeRows = state.rows.filter((row) => row.active);
  const lastUpdate = state.rows.reduce<string | null>((latest, row) => {
    if (!row.updatedAt) return latest;
    if (!latest || row.updatedAt > latest) return row.updatedAt;
    return latest;
  }, null);
  const needsRefresh = availabilityNeedsRefresh(lastUpdate);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{pm.availability.heading}</Text>
        <Text style={styles.subtitle}>{pm.availability.subtitle}</Text>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Badge label={activeRows.length > 0 ? 'Disponible' : 'Indisponible'} tone={activeRows.length > 0 ? 'success' : 'neutral'} />
            <View style={styles.statusText}>
              <Text style={styles.statusLevel}>{levelLabel(activeRows.length)}</Text>
              {needsRefresh ? (
                <Text style={styles.statusRefresh}>{pm.availability.needsRefresh}</Text>
              ) : lastUpdate ? (
                <Text style={styles.statusMeta}>{pm.availability.updatedAt}</Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.link} onPress={() => navigation.navigate('AvailabilityEdit')}>
            {pm.common.edit}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>{pm.availability.helpTitle}</Text>
        {state.rows.map((row) => (
          <Card key={row.code}>
            <View style={styles.typeRow}>
              <Text style={styles.typeMark}>{row.active ? '✓' : '—'}</Text>
              <Text style={[styles.typeLabel, !row.active ? styles.typeLabelInactive : null]}>{row.name}</Text>
            </View>
          </Card>
        ))}

        <Hint>{pm.availability.reminderTitle} {pm.availability.reminderHint}</Hint>

        <PrimaryButton label={pm.availability.editAction} onPress={() => navigation.navigate('AvailabilityEdit')} />
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
  subtitle: {
    ...textStyle.body,
    color: colors.textSecondary,
    marginTop: -space[3],
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[5],
    gap: space[2],
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  statusText: {
    gap: space[1],
  },
  statusLevel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusRefresh: {
    ...textStyle.caption,
    color: colors.warning,
    fontWeight: '600',
  },
  statusMeta: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  link: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
    textAlign: 'right',
  },
  sectionLabel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: space[2],
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  typeMark: {
    ...textStyle.body,
    color: colors.success,
    fontWeight: '700',
    width: 20,
  },
  typeLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  typeLabelInactive: {
    color: colors.textMuted,
  },
});
