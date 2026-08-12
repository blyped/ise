import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { frOnboarding } from '../../i18n/onboarding';
import { newCorrelationId } from '../../lib/correlation';
import {
  advanceOnboarding,
  loadCountries,
  loadExperienceCountryCodes,
  loadProfileVisibility,
  saveLocation,
  type CountryOption,
  type VisibilityLevel,
} from '../../lib/queries/onboarding';
import type { OnboardingStackParamList } from '../../navigation/onboarding-types';
import { TextField } from '../../components/TextField';
import { colors, space, textStyle } from '../../theme/tokens';
import { InfoBanner } from './_components/InfoBanner';
import { SelectModal } from './_components/SelectModal';
import { StepActions } from './_components/StepActions';
import { StepScaffold } from './_components/StepScaffold';
import { TokenPicker, type TokenOption } from './_components/TokenPicker';
import { useOnboardingSession } from './_components/useOnboardingSession';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingLocalisation'>;

/**
 * Étape 5/7 — Localisation (ISE-012). 249 pays (`public.countries`, D-64).
 * Le commutateur « Afficher ma ville » est un choix à 4 niveaux (D-73),
 * réduit ici à un binaire simple (privé / tous les membres) pour rester
 * fidèle au commutateur unique de la maquette mobile — les niveaux
 * intermédiaires (relations, promotion) restent modifiables ensuite depuis
 * « Mon profil » (ISE-024 et suivants, hors de cette tranche).
 */
export function LocationScreen({ navigation }: Props) {
  const [state, reload] = useOnboardingSession();
  const [countries, setCountries] = useState<readonly CountryOption[]>([]);
  const [currentCountryCode, setCurrentCountryCode] = useState<string | null>(null);
  const [currentCity, setCurrentCity] = useState('');
  const [zones, setZones] = useState<readonly TokenOption[]>([]);
  const [showCity, setShowCity] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (state.status !== 'ready') return;
    setCurrentCountryCode(state.session.profile.currentCountryCode);
    setCurrentCity(state.session.profile.currentCity ?? '');
    const correlationId = newCorrelationId();

    Promise.all([
      loadCountries(correlationId),
      loadExperienceCountryCodes(state.session.profile.id, correlationId),
      loadProfileVisibility(state.session.profile.id, correlationId),
    ]).then(([countriesResult, zonesResult, visibilityResult]) => {
      if (countriesResult.ok) {
        setCountries(countriesResult.data);
        if (zonesResult.ok) {
          setZones(
            countriesResult.data
              .filter((country) => zonesResult.data.includes(country.code))
              .map((country) => ({ value: country.code, label: country.name })),
          );
        }
      }
      if (visibilityResult.ok) {
        const level = visibilityResult.data['city'];
        setShowCity(level === undefined || level === 'members');
      }
    });
  }, [state]);

  async function submit(skip: boolean) {
    if (state.status !== 'ready') return;
    setPending(true);
    setError(undefined);
    const correlationId = newCorrelationId();

    if (!skip) {
      const cityVisibility: VisibilityLevel = showCity ? 'members' : 'private';
      const saved = await saveLocation(
        state.session.profile.id,
        {
          currentCountryCode,
          currentCity: currentCity.trim() || null,
          experienceCountryCodes: zones.map((zone) => zone.value),
          cityVisibility,
        },
        correlationId,
      );
      if (!saved.ok) {
        setPending(false);
        setError(saved.error.userMessage);
        return;
      }
    }

    const result = await advanceOnboarding(
      state.session.profile.id,
      5,
      state.session.progress.furthestStep,
      correlationId,
      { skipped: skip },
    );
    setPending(false);
    if (!result.ok) {
      setError(result.error.userMessage);
      return;
    }
    navigation.navigate('OnboardingDisponibilite');
  }

  return (
    <StepScaffold
      step={5}
      state={state}
      onRetry={reload}
      emptyTitle="Aucun profil rattaché à ce compte."
      emptyBody="Réclamez votre profil référencé avant de poursuivre l’onboarding."
    >
      {() => (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{frOnboarding.location.title}</Text>
            <Text style={styles.subtitle}>{frOnboarding.location.subtitle}</Text>
          </View>

          <Text style={styles.sectionTitle}>{frOnboarding.location.currentTitle}</Text>
          <SelectModal
            label={frOnboarding.location.countryLabel}
            placeholder={frOnboarding.location.countryPlaceholder}
            options={countries.map((country) => ({ value: country.code, label: country.name }))}
            value={currentCountryCode}
            onChange={setCurrentCountryCode}
          />
          <TextField
            label={frOnboarding.location.cityLabel}
            placeholder={frOnboarding.location.cityPlaceholder}
            value={currentCity}
            onChangeText={setCurrentCity}
            autoComplete="address-line1"
          />

          <View>
            <Text style={styles.sectionTitle}>{frOnboarding.location.zonesTitle}</Text>
            <Text style={styles.sectionHint}>{frOnboarding.location.zonesHint}</Text>
          </View>
          <TokenPicker
            searchLabel={frOnboarding.location.zonesTitle}
            searchPlaceholder={frOnboarding.location.zonesSearchPlaceholder}
            options={countries.map((country) => ({ value: country.code, label: country.name }))}
            selected={zones}
            onChange={setZones}
            emptyLabel="Aucun pays ne correspond à cette recherche."
          />

          <InfoBanner variant="success" title={frOnboarding.location.privacyTitle} body={frOnboarding.location.privacyBody} />

          <Pressable
            onPress={() => setShowCity((prev) => !prev)}
            style={styles.switchRow}
            accessibilityRole="switch"
            accessibilityState={{ checked: showCity }}
          >
            <Text style={styles.switchLabel}>{frOnboarding.location.showCityLabel}</Text>
            <Switch
              value={showCity}
              onValueChange={setShowCity}
              trackColor={{ false: colors.border, true: colors.actionBlue }}
            />
          </Pressable>

          {error ? <Text style={styles.formError}>{error}</Text> : null}

          <StepActions
            submitLabel={frOnboarding.location.submit}
            pendingLabel={frOnboarding.location.submitPending}
            isPending={pending}
            onSubmit={() => submit(false)}
            onBack={() => navigation.goBack()}
            onSkip={() => submit(true)}
          />
        </>
      )}
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space[2],
  },
  title: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...textStyle.body,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionHint: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
    marginTop: space[1],
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: space[5],
    paddingVertical: space[4],
  },
  switchLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  formError: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
