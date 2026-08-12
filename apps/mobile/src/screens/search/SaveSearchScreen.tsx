import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { frSearch } from '../../i18n/search';
import {
  ALERT_CHANNELS,
  ALERT_FREQUENCIES,
  criteriaChips,
  deleteSavedSearch,
  listSavedSearches,
  saveSearchWithAlert,
  setSearchAlertStatus,
  type AlertChannel,
  type AlertFrequency,
  type SavedSearchView,
} from '../../lib/queries/search';
import type { SearchStackParamList } from '../../navigation/SearchStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; searches: SavedSearchView[] };

type SubmitState = { status: 'idle' } | { status: 'saving' } | { status: 'error' } | { status: 'success' };

type Props = NativeStackScreenProps<SearchStackParamList, 'SaveSearch'>;

const FREQUENCY_LABELS: Record<AlertFrequency, string> = {
  daily: frSearch.save.frequencyDaily,
  weekly: frSearch.save.frequencyWeekly,
  monthly: frSearch.save.frequencyMonthly,
};

const CHANNEL_LABELS: Record<AlertChannel, string> = {
  in_app: frSearch.save.channelInApp,
  email: frSearch.save.channelEmail,
  both: frSearch.save.channelBoth,
};

/**
 * ISE-036 — Enregistrer la recherche / alerte.
 *
 * Combine, comme `apps/web/src/app/rechercher/enregistrer/page.tsx`, le
 * formulaire d'enregistrement (si l'écran est ouvert avec des critères,
 * depuis ISE-035) et la gestion des recherches déjà enregistrées
 * (`list_saved_searches`, `set_search_alert_status`, `delete_saved_search`
 * — les trois RPC de lecture/gestion, toujours présentes même sans
 * critères en attente).
 *
 * E-03 : fréquences limitées à `daily/weekly/monthly`, canal à
 * `in_app/email/both` — aucune option « Immédiat » ni « Push mobile »,
 * la base ne les accepterait pas (contraintes CHECK de `search_alerts`).
 *
 * E-04 : ni compteur de profils, ni pastille « Très ciblée » — remplacés
 * par l'avertissement honnête sur l'absence du service d'alerte.
 */
export function SaveSearchScreen({ route }: Props) {
  const params = route.params;
  const [name, setName] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [frequency, setFrequency] = useState<AlertFrequency>('weekly');
  const [channel, setChannel] = useState<AlertChannel>('in_app');
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const [listState, setListState] = useState<ListState>({ status: 'loading' });

  const loadList = useCallback(() => {
    setListState({ status: 'loading' });
    listSavedSearches()
      .then((result) => {
        setListState(result.failed ? { status: 'error' } : { status: 'ready', searches: [...result.searches] });
      })
      .catch(() => setListState({ status: 'error' }));
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const submit = () => {
    if (params === undefined) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setNameError(frSearch.save.nameRequired);
      return;
    }
    if (trimmed.length > 120) {
      setNameError(frSearch.save.nameTooLong);
      return;
    }
    setNameError(null);
    setSubmitState({ status: 'saving' });

    saveSearchWithAlert({
      name: trimmed,
      criteria: params.criteria,
      alertEnabled,
      frequency,
      channel,
    })
      .then((result) => {
        if (result.failed) {
          setSubmitState({ status: 'error' });
          return;
        }
        setSubmitState({ status: 'success' });
        setName('');
        loadList();
      })
      .catch(() => setSubmitState({ status: 'error' }));
  };

  const toggleAlert = (search: SavedSearchView) => {
    const nextStatus = search.alertStatus === 'active' ? 'paused' : 'active';
    setSearchAlertStatus(search.savedSearchId, nextStatus).then((result) => {
      if (!result.failed) loadList();
    });
  };

  const remove = (search: SavedSearchView) => {
    Alert.alert(frSearch.save.listDelete, frSearch.save.listDeleteConfirm, [
      { text: frSearch.common.cancel, style: 'cancel' },
      {
        text: frSearch.save.listDelete,
        style: 'destructive',
        onPress: () => {
          deleteSavedSearch(search.savedSearchId).then((result) => {
            if (!result.failed) loadList();
          });
        },
      },
    ]);
  };

  const chips = params !== undefined ? criteriaChips(params.criteria, {
    sectorLabel: params.labels?.sectorLabel ?? null,
    countryLabel: params.labels?.countryLabel ?? null,
    availabilityLabel: params.labels?.availabilityLabel ?? null,
  }) : [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {params !== undefined ? (
          <>
            <Text style={styles.heading}>{frSearch.save.title}</Text>
            <Text style={styles.subtitle}>{frSearch.save.subtitle}</Text>

            <View style={styles.field}>
              <TextField
                label={frSearch.save.nameLabel}
                placeholder={frSearch.save.namePlaceholder}
                value={name}
                onChangeText={setName}
                error={nameError ?? undefined}
              />
              <Text style={styles.hint}>{frSearch.save.nameHint}</Text>
            </View>

            <Text style={styles.label}>{frSearch.save.criteriaLegend}</Text>
            {chips.length === 0 ? (
              <Text style={styles.hint}>{frSearch.save.criteriaEmpty}</Text>
            ) : (
              <View style={styles.chipRow}>
                {chips.map((chip) => (
                  <View key={`${chip.dimension}-${chip.value}`} style={styles.chip}>
                    <Text style={styles.chipLabel}>{chip.label}</Text>
                  </View>
                ))}
              </View>
            )}

            <Pressable
              onPress={() => setAlertEnabled((current) => !current)}
              style={styles.toggleRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: alertEnabled }}
            >
              <View style={[styles.checkbox, alertEnabled ? styles.checkboxChecked : null]}>
                {alertEnabled ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.toggleLabel}>{frSearch.save.alertToggle}</Text>
            </Pressable>
            <Text style={styles.hint}>{frSearch.save.alertToggleHint}</Text>

            {alertEnabled ? (
              <>
                <Text style={styles.label}>{frSearch.save.frequencyLabel}</Text>
                <View style={styles.chipRow}>
                  {ALERT_FREQUENCIES.map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setFrequency(value)}
                      style={[styles.optionChip, frequency === value ? styles.optionChipSelected : null]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: frequency === value }}
                    >
                      <Text
                        style={[
                          styles.optionChipLabel,
                          frequency === value ? styles.optionChipLabelSelected : null,
                        ]}
                      >
                        {FREQUENCY_LABELS[value]}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>{frSearch.save.channelLabel}</Text>
                <View style={styles.chipRow}>
                  {ALERT_CHANNELS.map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setChannel(value)}
                      style={[styles.optionChip, channel === value ? styles.optionChipSelected : null]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: channel === value }}
                    >
                      <Text
                        style={[
                          styles.optionChipLabel,
                          channel === value ? styles.optionChipLabelSelected : null,
                        ]}
                      >
                        {CHANNEL_LABELS[value]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>{frSearch.save.workerWarningTitle}</Text>
              <Text style={styles.warningBody}>{frSearch.save.workerWarningBody}</Text>
            </View>

            {submitState.status === 'error' ? (
              <Text style={styles.error}>{frSearch.save.errorTitle}</Text>
            ) : null}
            {submitState.status === 'success' ? (
              <Text style={styles.success}>{frSearch.save.successTitle}</Text>
            ) : null}

            <View style={styles.submitRow}>
              <Button
                label={frSearch.save.submitCreate}
                onPress={submit}
                loading={submitState.status === 'saving'}
              />
            </View>
          </>
        ) : null}

        <Text style={styles.heading2}>{frSearch.save.listTitle}</Text>

        {listState.status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.actionBlue} />
          </View>
        ) : null}

        {listState.status === 'error' ? (
          <ErrorState title={frSearch.save.errorTitle} onRetry={loadList} />
        ) : null}

        {listState.status === 'ready' && listState.searches.length === 0 ? (
          <Text style={styles.hint}>{frSearch.save.listEmpty}</Text>
        ) : null}

        {listState.status === 'ready'
          ? listState.searches.map((search) => (
              <View key={search.savedSearchId} style={styles.savedCard}>
                <Text style={styles.savedName}>{search.name}</Text>
                <Text style={styles.savedStatus}>
                  {search.alertStatus === 'active' && search.alertFrequency !== null && search.alertChannel !== null
                    ? frSearch.save.listAlertActive
                        .replace('{frequency}', FREQUENCY_LABELS[search.alertFrequency])
                        .replace('{channel}', CHANNEL_LABELS[search.alertChannel])
                    : search.alertStatus === 'paused' && search.alertFrequency !== null && search.alertChannel !== null
                      ? frSearch.save.listAlertPaused
                          .replace('{frequency}', FREQUENCY_LABELS[search.alertFrequency])
                          .replace('{channel}', CHANNEL_LABELS[search.alertChannel])
                      : frSearch.save.listAlertNone}
                </Text>
                <View style={styles.savedActionsRow}>
                  {search.alertStatus !== null ? (
                    <Pressable onPress={() => toggleAlert(search)} accessibilityRole="button">
                      <Text style={styles.savedAction}>
                        {search.alertStatus === 'active' ? frSearch.save.listPause : frSearch.save.listResume}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => remove(search)} accessibilityRole="button">
                    <Text style={styles.savedActionDestructive}>{frSearch.save.listDelete}</Text>
                  </Pressable>
                </View>
              </View>
            ))
          : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: space[8],
  },
  heading: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: space[2],
  },
  heading2: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: space[7],
    marginBottom: space[3],
  },
  subtitle: {
    ...textStyle.body,
    color: colors.textSecondary,
    marginBottom: space[6],
  },
  field: {
    marginBottom: space[5],
  },
  label: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: space[4],
    marginBottom: space[2],
  },
  hint: {
    ...textStyle.caption,
    color: colors.textMuted,
    marginTop: space[1],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginTop: space[5],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.actionBlue,
    borderColor: colors.actionBlue,
  },
  checkboxMark: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 14,
  },
  toggleLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    flex: 1,
  },
  optionChip: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderRadius: rounded.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionChipSelected: {
    backgroundColor: colors.actionBlue,
    borderColor: colors.actionBlue,
  },
  optionChipLabel: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  optionChipLabelSelected: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  warningBox: {
    marginTop: space[6],
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: space[4],
    gap: space[1],
  },
  warningTitle: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  warningBody: {
    ...textStyle.caption,
    color: colors.textSecondary,
  },
  error: {
    ...textStyle.bodySm,
    color: colors.error,
    marginTop: space[4],
  },
  success: {
    ...textStyle.bodySm,
    color: colors.success,
    marginTop: space[4],
  },
  submitRow: {
    marginTop: space[5],
  },
  centered: {
    alignItems: 'center',
    paddingVertical: space[5],
  },
  savedCard: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    marginBottom: space[3],
    gap: space[2],
  },
  savedName: {
    ...textStyle.body,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  savedStatus: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  savedActionsRow: {
    flexDirection: 'row',
    gap: space[5],
    marginTop: space[1],
  },
  savedAction: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  savedActionDestructive: {
    ...textStyle.bodySm,
    color: colors.error,
    fontWeight: '600',
  },
});
