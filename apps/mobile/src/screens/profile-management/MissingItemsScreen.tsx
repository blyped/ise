import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { EmptyState } from '../../components/EmptyState';
import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import { loadMyMissingItems, missingItemImpact, type MissingItem } from '../../lib/queries/profile-management';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import { Badge, Card, ErrorBanner, Hint, LoadingView, PrimaryButton, routeForBlockKey } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'MissingItems'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; items: MissingItem[] };

/** ISE-031 — Éléments manquants & suggestions (aucune n'est bloquante, D-71/D-72). */
export function MissingItemsScreen({ navigation }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadMyMissingItems().then((result) => {
      if (!result.ok) {
        setState({ status: 'error', correlationId: result.correlationId });
        return;
      }
      setState({ status: 'ready', items: result.data });
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === 'loading') return <Screen><LoadingView /></Screen>;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorBanner title={pm.missingItems.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  if (state.items.length === 0) {
    return (
      <Screen>
        <EmptyState title={pm.missingItems.banner} description={pm.missingItems.bannerHint} />
      </Screen>
    );
  }

  const sorted = [...state.items].sort((a, b) => b.weight - a.weight);
  const priorities = sorted.slice(0, 2);
  const rest = sorted.slice(2);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{pm.missingItems.heading}</Text>
        <Text style={styles.subtitle}>
          {state.items.length} suggestion(s) · {pm.missingItems.subtitle}
        </Text>

        <Hint tone="success">{pm.missingItems.banner} {pm.missingItems.bannerHint}</Hint>

        {priorities.map((item, index) => (
          <Card key={item.blockKey}>
            <Badge label={`Priorité ${index + 1}`} tone="warning" />
            <Text style={styles.itemLabel}>{item.label}</Text>
            {item.hint ? <Text style={styles.itemHint}>{item.hint}</Text> : null}
            <View style={styles.itemFooter}>
              <Text style={styles.impactLabel}>{pm.missingItems.impact[missingItemImpact(item.weight)]}</Text>
              <PrimaryButton label={pm.missingItems.doAction} onPress={() => navigation.navigate(routeForBlockKey(item.blockKey))} />
            </View>
          </Card>
        ))}

        {rest.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>{pm.missingItems.canWaitTitle}</Text>
            <Text style={styles.canWaitHint}>{pm.missingItems.canWaitHint}</Text>
            {rest.map((item) => (
              <View key={item.blockKey} style={styles.restRow}>
                <Text style={styles.restLabel}>{item.label}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Hint>{pm.missingItems.footerNote}</Hint>
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
  itemLabel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  itemHint: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space[2],
  },
  impactLabel: {
    ...textStyle.bodySm,
    color: colors.success,
    fontWeight: '700',
  },
  sectionLabel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: space[2],
  },
  canWaitHint: {
    ...textStyle.caption,
    color: colors.textSecondary,
    marginTop: -space[2],
  },
  restRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: space[4],
    backgroundColor: colors.surface,
  },
  restLabel: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
});
