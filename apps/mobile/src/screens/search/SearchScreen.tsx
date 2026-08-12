import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { frSearch } from '../../i18n/search';
import {
  hasAnyCriteria,
  listSavedSearches,
  loadSearchReferentials,
  type ReferenceOption,
  type SavedSearchView,
  type SearchCriteria,
  type SearchReferentials,
} from '../../lib/queries/search';
import type { SearchStackParamList } from '../../navigation/SearchStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type ReferentialState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; referentials: SearchReferentials };

type SavedState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; searches: SavedSearchView[] };

type Props = NativeStackScreenProps<SearchStackParamList, 'Search'>;

/**
 * ISE-034 — Trouver un ISE.
 *
 * Point d'entree de la tranche Recherche & decouverte, accessible depuis
 * l'action centrale « + » (D-94) une fois `SearchStack` branchee dans
 * `AppTabs.tsx` (voir rapport de livraison — ce fichier de navigation
 * partage n'est pas modifie par cette tranche).
 *
 * Seules QUATRE dimensions de `searchCriteriaSchema` sont pilotables ici
 * (secteur, pays, disponibilite, experience minimum), en plus du texte
 * libre — voir la note d'en-tete de `lib/queries/search.ts` pour la
 * justification. La bascule annuaire/pertinence (D-152/E-02) reste
 * exactement celle du web : elle n'est pas devinee ici, elle est relue
 * par `SearchResultsScreen` a partir des memes criteres.
 */
export function SearchScreen({ navigation }: Props) {
  const [referentialState, setReferentialState] = useState<ReferentialState>({ status: 'loading' });
  const [savedState, setSavedState] = useState<SavedState>({ status: 'loading' });

  const [query, setQuery] = useState('');
  const [sectorId, setSectorId] = useState<number | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [availabilityCode, setAvailabilityCode] = useState<string | null>(null);
  const [minYears, setMinYears] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadReferentials = useCallback(() => {
    setReferentialState({ status: 'loading' });
    loadSearchReferentials()
      .then((referentials) => {
        setReferentialState(
          referentials.failed
            ? { status: 'error' }
            : { status: 'ready', referentials },
        );
      })
      .catch(() => setReferentialState({ status: 'error' }));
  }, []);

  const loadSaved = useCallback(() => {
    setSavedState({ status: 'loading' });
    listSavedSearches()
      .then((result) => {
        setSavedState(result.failed ? { status: 'error' } : { status: 'ready', searches: [...result.searches] });
      })
      .catch(() => setSavedState({ status: 'error' }));
  }, []);

  useEffect(() => {
    loadReferentials();
    loadSaved();
  }, [loadReferentials, loadSaved]);

  const buildCriteria = (): SearchCriteria => {
    const parsedYears = Number.parseInt(minYears, 10);
    return {
      query,
      sectorIds: sectorId !== null ? [sectorId] : [],
      countryCodes: countryCode !== null ? [countryCode] : [],
      availabilityTypes: availabilityCode !== null ? [availabilityCode] : [],
      minYearsOfExperience: Number.isInteger(parsedYears) && parsedYears >= 0 ? parsedYears : null,
    };
  };

  const labelsFor = (referentials: SearchReferentials) => ({
    sectorLabel: referentials.sectors.find((option) => option.value === String(sectorId))?.label ?? null,
    countryLabel: referentials.countries.find((option) => option.value === countryCode)?.label ?? null,
    availabilityLabel:
      referentials.availabilityTypes.find((option) => option.value === availabilityCode)?.label ?? null,
  });

  const submit = () => {
    const criteria = buildCriteria();
    if (!hasAnyCriteria(criteria)) {
      setValidationError(frSearch.find.noCriteria);
      return;
    }
    setValidationError(null);
    const referentials = referentialState.status === 'ready' ? referentialState.referentials : null;
    navigation.navigate('SearchResults', {
      criteria,
      labels: referentials
        ? labelsFor(referentials)
        : { sectorLabel: null, countryLabel: null, availabilityLabel: null },
    });
  };

  const relaunch = (search: SavedSearchView) => {
    if (search.criteria === null) return;
    const referentials = referentialState.status === 'ready' ? referentialState.referentials : null;
    const criteria = search.criteria;
    navigation.navigate('SearchResults', {
      criteria,
      labels: {
        sectorLabel:
          referentials?.sectors.find((option) => option.value === String(criteria.sectorIds[0] ?? ''))
            ?.label ?? null,
        countryLabel:
          referentials?.countries.find((option) => option.value === criteria.countryCodes[0])?.label ??
          null,
        availabilityLabel:
          referentials?.availabilityTypes.find((option) => option.value === criteria.availabilityTypes[0])
            ?.label ?? null,
      },
    });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>{frSearch.find.title}</Text>
        <Text style={styles.subtitle}>{frSearch.find.subtitle}</Text>

        <View style={styles.field}>
          <TextField
            label={frSearch.find.queryLabel}
            placeholder={frSearch.find.queryPlaceholder}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={submit}
          />
          <Text style={styles.hint}>{frSearch.find.queryHint}</Text>
        </View>

        <Text style={styles.sectionTitle}>{frSearch.find.criteriaLegend}</Text>
        <Text style={styles.hint}>{frSearch.find.criteriaHint}</Text>

        {referentialState.status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.actionBlue} />
          </View>
        ) : null}

        {referentialState.status === 'error' ? (
          <ErrorState
            title={frSearch.find.referentialsErrorTitle}
            onRetry={loadReferentials}
          />
        ) : null}

        {referentialState.status === 'ready' ? (
          <>
            <ChipGroup
              label={frSearch.find.sectorsLabel}
              options={referentialState.referentials.sectors}
              selected={sectorId !== null ? String(sectorId) : null}
              onSelect={(value) => setSectorId(value !== null ? Number.parseInt(value, 10) : null)}
            />
            <ChipGroup
              label={frSearch.find.countriesLabel}
              options={referentialState.referentials.countries}
              selected={countryCode}
              onSelect={setCountryCode}
            />
            <ChipGroup
              label={frSearch.find.availabilityLabel}
              options={referentialState.referentials.availabilityTypes}
              selected={availabilityCode}
              onSelect={setAvailabilityCode}
            />

            <View style={styles.field}>
              <TextField
                label={frSearch.find.experienceLabel}
                placeholder={frSearch.find.experiencePlaceholder}
                value={minYears}
                onChangeText={(value) => setMinYears(value.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            </View>
          </>
        ) : null}

        {validationError !== null ? <Text style={styles.error}>{validationError}</Text> : null}

        <View style={styles.submitRow}>
          <Button label={frSearch.find.submit} onPress={submit} />
        </View>
        <Text style={styles.hint}>{frSearch.find.submitHint}</Text>

        <Text style={styles.sectionTitle}>{frSearch.find.savedTitle}</Text>

        {savedState.status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.actionBlue} />
          </View>
        ) : null}

        {savedState.status === 'error' ? (
          <ErrorState title={frSearch.save.errorTitle} onRetry={loadSaved} />
        ) : null}

        {savedState.status === 'ready' && savedState.searches.length === 0 ? (
          <Text style={styles.hint}>{frSearch.find.savedEmpty}</Text>
        ) : null}

        {savedState.status === 'ready'
          ? savedState.searches.map((search) => (
              <Pressable
                key={search.savedSearchId}
                style={styles.savedCard}
                onPress={() => relaunch(search)}
                accessibilityRole="button"
              >
                <Text style={styles.savedName}>{search.name}</Text>
                <Text style={styles.savedStatus}>
                  {search.alertStatus === 'active'
                    ? frSearch.find.savedAlertOn
                    : search.alertStatus === 'paused'
                      ? frSearch.find.savedAlertPaused
                      : frSearch.find.savedAlertOff}
                </Text>
                <Text style={styles.savedAction}>{frSearch.find.savedOpen}</Text>
              </Pressable>
            ))
          : null}
      </ScrollView>
    </Screen>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: readonly ReferenceOption[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  if (options.length === 0) return null;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <Pressable
              key={option.value}
              onPress={() => onSelect(isSelected ? null : option.value)}
              style={[styles.chip, isSelected ? styles.chipSelected : null]}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.chipLabel, isSelected ? styles.chipLabelSelected : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
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
  subtitle: {
    ...textStyle.body,
    color: colors.textSecondary,
    marginBottom: space[6],
  },
  sectionTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: space[6],
    marginBottom: space[2],
  },
  field: {
    marginBottom: space[5],
  },
  label: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: space[2],
  },
  hint: {
    ...textStyle.caption,
    color: colors.textMuted,
    marginTop: space[2],
  },
  centered: {
    alignItems: 'center',
    paddingVertical: space[5],
  },
  chipRow: {
    gap: space[2],
    paddingVertical: space[1],
  },
  chip: {
    paddingHorizontal: space[5],
    paddingVertical: space[3],
    borderRadius: rounded.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.actionBlue,
    borderColor: colors.actionBlue,
  },
  chipLabel: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  chipLabelSelected: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  error: {
    ...textStyle.bodySm,
    color: colors.error,
    marginBottom: space[3],
  },
  submitRow: {
    marginTop: space[2],
  },
  savedCard: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    marginBottom: space[3],
    gap: space[1],
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
  savedAction: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
    marginTop: space[1],
  },
});
