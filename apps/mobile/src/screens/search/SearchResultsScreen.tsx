import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RELEVANCE_LABELS } from '@ise/domain';

import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frSearch } from '../../i18n/search';
import { newCorrelationId } from '../../lib/correlation';
import { criteriaChips, runSearch, type SearchMode, type SearchResultRow } from '../../lib/queries/search';
import type { SearchStackParamList } from '../../navigation/SearchStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; rows: SearchResultRow[]; nextCursor: string | null; loadingMore: boolean; mode: SearchMode };

type Props = NativeStackScreenProps<SearchStackParamList, 'SearchResults'>;

/**
 * ISE-035 — Résultats.
 *
 * D-151/E-01 : ni total de résultats, ni pagination numérotée — seul le
 * nombre de lignes RENDUES est affiché, avec un bouton « Charger la page
 * suivante » branché sur le curseur keyset renvoyé par la RPC (D-44).
 *
 * D-152/E-02 : le libellé qualitatif de pertinence et les raisons ne
 * sont rendus qu'en mode pertinence (`match_profiles`) — jamais fabriqués
 * en mode annuaire (`search_profiles`).
 */
export function SearchResultsScreen({ route, navigation }: Props) {
  const { criteria, labels } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(() => {
    setState({ status: 'loading' });
    runSearch(criteria, null)
      .then((result) => {
        if (result.failed || result.page === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({
          status: 'ready',
          rows: [...result.page.rows],
          nextCursor: result.page.nextCursor,
          loadingMore: false,
          mode: result.page.mode,
        });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(criteria)]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'ready' || prev.nextCursor === null || prev.loadingMore) return prev;

      runSearch(criteria, prev.nextCursor).then((result) => {
        setState((current) => {
          if (current.status !== 'ready') return current;
          if (result.failed || result.page === null) return { ...current, loadingMore: false };
          return {
            ...current,
            rows: [...current.rows, ...result.page.rows],
            nextCursor: result.page.nextCursor,
            loadingMore: false,
          };
        });
      });

      return { ...prev, loadingMore: true };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(criteria)]);

  const chips = criteriaChips(criteria, labels);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button">
          <Text style={styles.link}>{frSearch.results.backToSearch}</Text>
        </Pressable>
        {state.status === 'ready' ? (
          <Pressable
            onPress={() => navigation.navigate('SaveSearch', { criteria, labels })}
            accessibilityRole="button"
          >
            <Text style={styles.link}>{frSearch.results.saveSearch}</Text>
          </Pressable>
        ) : null}
      </View>

      {state.status === 'ready' ? (
        <View style={styles.modeBox}>
          <Text style={styles.modeTitle}>
            {state.mode === 'relevance' ? frSearch.results.modeRelevance : frSearch.results.modeDirectory}
          </Text>
          <Text style={styles.modeHint}>
            {state.mode === 'relevance'
              ? frSearch.results.modeRelevanceHint
              : frSearch.results.modeDirectoryHint}
          </Text>
        </View>
      ) : null}

      {chips.length > 0 ? (
        <View style={styles.chipRow}>
          {chips.map((chip) => (
            <View key={`${chip.dimension}-${chip.value}`} style={styles.chip}>
              <Text style={styles.chipLabel}>{chip.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {state.status === 'loading' ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      ) : null}

      {state.status === 'error' ? (
        <ErrorState title={frSearch.results.errorTitle} correlationId={state.correlationId} onRetry={load} />
      ) : null}

      {state.status === 'ready' && state.rows.length === 0 ? (
        <EmptyState title={frSearch.results.emptyTitle} description={frSearch.results.emptyBody} />
      ) : null}

      {state.status === 'ready' && state.rows.length > 0 ? (
        <>
          <Text style={styles.count}>
            {(state.rows.length === 1 ? frSearch.results.countOne : frSearch.results.countMany).replace(
              '{count}',
              String(state.rows.length),
            )}
          </Text>
          <FlatList
            data={state.rows}
            keyExtractor={(row) => row.profileId}
            renderItem={({ item }) => (
              <ResultCard row={item} onPress={() => navigation.navigate('SearchProfile', { profileId: item.profileId })} />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.list}
            ListFooterComponent={
              state.nextCursor !== null ? (
                <View style={styles.loadMore}>
                  <Button label={frSearch.results.loadMore} onPress={loadMore} loading={state.loadingMore} />
                </View>
              ) : (
                <Text style={styles.endOfResults}>{frSearch.results.endOfResults}</Text>
              )
            }
          />
        </>
      ) : null}
    </Screen>
  );
}

function ResultCard({ row, onPress }: { row: SearchResultRow; onPress: () => void }) {
  const secondaryLine = [row.promotionLabel, row.currentCity, row.currentCountryCode]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');
  const positionLine = [row.currentPosition, row.currentOrganization]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');
  const isSparse = positionLine.length === 0 && row.topSkills.length === 0 && !row.headline;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.name}>{row.displayName}</Text>
        {row.verificationStatus === 'verified' ? (
          <View style={styles.badgeSuccess}>
            <Text style={styles.badgeSuccessLabel}>{frSearch.results.verified}</Text>
          </View>
        ) : null}
      </View>

      {secondaryLine.length > 0 ? <Text style={styles.subtitle}>{secondaryLine}</Text> : null}
      {positionLine.length > 0 ? <Text style={styles.position}>{positionLine}</Text> : null}
      {row.headline ? (
        <Text style={styles.headline} numberOfLines={2}>
          {row.headline}
        </Text>
      ) : null}

      {row.topSkills.length > 0 ? (
        <View style={styles.chipRow}>
          {row.topSkills.slice(0, 3).map((skill) => (
            <View key={skill} style={styles.skillChip}>
              <Text style={styles.skillChipLabel}>{skill}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {isSparse ? <Text style={styles.hint}>{frSearch.results.partialProfile}</Text> : null}

      {row.relevanceLabel !== null ? (
        <View style={styles.reasonsBox}>
          <View style={styles.badgeInfo}>
            <Text style={styles.badgeInfoLabel}>{RELEVANCE_LABELS[row.relevanceLabel]}</Text>
          </View>
          {row.reasons.length > 0 ? (
            <>
              <Text style={styles.reasonsTitle}>{frSearch.results.whyThisProfile}</Text>
              {row.reasons.map((reason) => (
                <Text key={`${reason.criterion}-${reason.label}`} style={styles.reason}>
                  · {reason.label}
                </Text>
              ))}
            </>
          ) : null}
        </View>
      ) : null}

      {row.openAvailabilityTypes.length > 0 ? (
        <Text style={styles.hint}>
          {frSearch.results.availableFor} : {row.openAvailabilityTypes.join(' · ')}
        </Text>
      ) : null}

      <Pressable onPress={onPress} style={styles.viewProfileButton} accessibilityRole="button">
        <Text style={styles.viewProfileLabel}>{frSearch.results.viewProfile}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space[4],
  },
  link: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  modeBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.base,
    padding: space[4],
    marginBottom: space[4],
    gap: space[1],
  },
  modeTitle: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modeHint: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginBottom: space[4],
  },
  chip: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
  },
  chipLabel: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: space[6],
  },
  count: {
    ...textStyle.caption,
    color: colors.textMuted,
    marginBottom: space[3],
  },
  list: {
    paddingBottom: space[6],
  },
  separator: {
    height: space[4],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    gap: space[1],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  name: {
    ...textStyle.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  badgeSuccess: {
    backgroundColor: colors.success,
    borderRadius: rounded.full,
    paddingHorizontal: space[3],
    paddingVertical: 2,
  },
  badgeSuccessLabel: {
    ...textStyle.caption,
    color: colors.textInverse,
    fontWeight: '600',
  },
  subtitle: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  position: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  headline: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  skillChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.full,
    paddingHorizontal: space[3],
    paddingVertical: 2,
  },
  skillChipLabel: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  hint: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  reasonsBox: {
    marginTop: space[2],
    gap: space[1],
  },
  badgeInfo: {
    alignSelf: 'flex-start',
    backgroundColor: colors.info,
    borderRadius: rounded.full,
    paddingHorizontal: space[3],
    paddingVertical: 2,
  },
  badgeInfoLabel: {
    ...textStyle.caption,
    color: colors.textInverse,
    fontWeight: '600',
  },
  reasonsTitle: {
    ...textStyle.caption,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: space[1],
  },
  reason: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  viewProfileButton: {
    marginTop: space[3],
    minHeight: 44,
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewProfileLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  loadMore: {
    marginTop: space[5],
    alignItems: 'center',
  },
  endOfResults: {
    ...textStyle.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: space[5],
  },
});
