import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  loadCountries,
  loadExperience,
  loadSectors,
  saveExperience,
  type CountryOption,
  type SectorOption,
  type VisibilityLevel,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import {
  ErrorBanner,
  FormActions,
  LoadingView,
  SearchPickerModal,
  SelectField,
  VisibilityPicker,
  useModalState,
} from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'ExperienceForm'>;

/** ISE-019 — Ajouter / modifier une expérience. */
export function ExperienceFormScreen({ route, navigation }: Props) {
  const experienceId = route.params?.experienceId;
  const profileId = useProfileId();
  const isEdit = experienceId !== undefined;

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [organizationNameRaw, setOrganizationNameRaw] = useState('');
  const [positionTitle, setPositionTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(false);
  const [city, setCity] = useState('');
  const [countryCode, setCountryCode] = useState<string | undefined>(undefined);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [sectorId, setSectorId] = useState<number | undefined>(undefined);
  const [sectorName, setSectorName] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<VisibilityLevel>('members');

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const countryModal = useModalState();
  const sectorModal = useModalState();

  useEffect(() => {
    loadCountries().then((result) => {
      if (result.ok) setCountries(result.data);
    });
    loadSectors().then((result) => {
      if (result.ok) setSectors(result.data);
    });
  }, []);

  useEffect(() => {
    if (!experienceId) return;
    loadExperience(profileId, experienceId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      const row = result.data;
      if (!row) return;
      setOrganizationNameRaw(row.organizationName);
      setPositionTitle(row.positionTitle);
      setStartDate(row.startDate);
      setEndDate(row.endDate ?? '');
      setIsCurrent(row.isCurrent);
      setCity(row.city ?? '');
      setCountryCode(row.countryCode ?? undefined);
      setCountryName(row.countryName);
      setSectorId(row.sectorId ?? undefined);
      setSectorName(row.sectorName);
      setDescription(row.description ?? '');
      setVisibility(row.visibility);
    });
  }, [experienceId, profileId]);

  async function submit() {
    setSaving(true);
    setSaveError(null);
    const result = await saveExperience(profileId, {
      experienceId,
      organizationNameRaw,
      positionTitle,
      sectorId,
      countryCode,
      city,
      startDate,
      endDate: isCurrent ? undefined : endDate,
      isCurrent,
      description,
      visibility,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    navigation.goBack();
  }

  if (loading) return <Screen><LoadingView /></Screen>;
  if (loadError) {
    return (
      <Screen>
        <ErrorBanner title={pm.experienceForm.errorTitle} correlationId={undefined} />
        <Text style={styles.error}>{loadError}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{isEdit ? pm.experienceForm.headingEdit : pm.experienceForm.heading}</Text>
        <Text style={styles.subtitle}>{pm.experienceForm.subtitle}</Text>

        <TextField label={pm.experienceForm.organizationLabel} value={organizationNameRaw} onChangeText={setOrganizationNameRaw} />
        <TextField label={pm.experienceForm.positionLabel} value={positionTitle} onChangeText={setPositionTitle} />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <TextField label={pm.experienceForm.startDateLabel} value={startDate} onChangeText={setStartDate} placeholder="2021-01-01" />
          </View>
          <View style={styles.rowItem}>
            <TextField
              label={pm.experienceForm.endDateLabel}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2023-06-30"
              editable={!isCurrent}
            />
          </View>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{pm.experienceForm.currentLabel}</Text>
          <Switch value={isCurrent} onValueChange={setIsCurrent} accessibilityLabel={pm.experienceForm.currentLabel} />
        </View>

        <TextField label={pm.experienceForm.cityLabel} value={city} onChangeText={setCity} />
        <SelectField label={pm.experienceForm.sectorLabel} value={sectorName} placeholder={pm.experienceForm.sectorLabel} onPress={sectorModal.open} />
        <SelectField label={pm.header.countryLabel} value={countryName} placeholder={pm.header.countryLabel} onPress={countryModal.open} />

        <TextField
          label={pm.experienceForm.descriptionLabel}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

        <FormActions
          onCancel={() => navigation.goBack()}
          onSubmit={submit}
          submitLabel={pm.common.save}
          saving={saving}
        />
      </ScrollView>

      <SearchPickerModal
        visible={countryModal.visible}
        title={pm.header.countryLabel}
        placeholder="Rechercher un pays…"
        query={countryModal.query}
        onQueryChange={countryModal.setQuery}
        onClose={countryModal.close}
        options={countries.filter((c) => c.name.toLowerCase().includes(countryModal.query.toLowerCase())).map((c) => ({ key: c.code, label: c.name }))}
        onSelect={(option) => {
          setCountryCode(option.key);
          setCountryName(option.label);
          countryModal.close();
        }}
      />
      <SearchPickerModal
        visible={sectorModal.visible}
        title={pm.experienceForm.sectorLabel}
        placeholder="Rechercher un secteur…"
        query={sectorModal.query}
        onQueryChange={sectorModal.setQuery}
        onClose={sectorModal.close}
        options={sectors.filter((s) => s.name.toLowerCase().includes(sectorModal.query.toLowerCase())).map((s) => ({ key: String(s.id), label: s.name }))}
        onSelect={(option) => {
          setSectorId(Number(option.key));
          setSectorName(option.label);
          sectorModal.close();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space[5],
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
  row: {
    flexDirection: 'row',
    gap: space[4],
  },
  rowItem: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: space[4],
  },
  switchLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  error: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
