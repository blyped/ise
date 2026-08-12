import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  loadCountries,
  loadEducation,
  saveEducation,
  type CountryOption,
  type VisibilityLevel,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import {
  ErrorBanner,
  FormActions,
  LoadingView,
  Pill,
  SearchPickerModal,
  SelectField,
  VisibilityPicker,
  useModalState,
} from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'EducationForm'>;

type EducationType = 'academic' | 'certification';

/** ISE-021 — Ajouter / modifier une formation ou certification. */
export function EducationFormScreen({ route, navigation }: Props) {
  const educationId = route.params?.educationId;
  const profileId = useProfileId();
  const isEdit = educationId !== undefined;

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [educationType, setEducationType] = useState<EducationType>('academic');
  const [institution, setInstitution] = useState('');
  const [degree, setDegree] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [countryCode, setCountryCode] = useState<string | undefined>(undefined);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [credentialUrl, setCredentialUrl] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<VisibilityLevel>('members');

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const countryModal = useModalState();

  useEffect(() => {
    loadCountries().then((result) => {
      if (result.ok) setCountries(result.data);
    });
  }, []);

  useEffect(() => {
    if (!educationId) return;
    loadEducation(profileId, educationId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      const row = result.data;
      if (!row) return;
      setEducationType(row.educationType);
      setInstitution(row.institution);
      setDegree(row.degree ?? '');
      setFieldOfStudy(row.fieldOfStudy ?? '');
      setCountryCode(row.countryCode ?? undefined);
      setCountryName(row.countryName);
      setCity(row.city ?? '');
      setStartYear(row.startYear !== null ? String(row.startYear) : '');
      setEndYear(row.endYear !== null ? String(row.endYear) : '');
      setCredentialUrl(row.credentialUrl ?? '');
      setDescription(row.description ?? '');
      setVisibility(row.visibility);
    });
  }, [educationId, profileId]);

  async function submit() {
    setSaving(true);
    setSaveError(null);
    const result = await saveEducation(profileId, {
      educationId,
      educationType,
      institution,
      degree,
      fieldOfStudy,
      countryCode,
      city,
      startYear,
      endYear,
      credentialUrl,
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
        <ErrorBanner title={pm.educationForm.errorTitle} correlationId={undefined} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{isEdit ? pm.educationForm.headingEdit : pm.educationForm.heading}</Text>
        <Text style={styles.subtitle}>{pm.educationForm.subtitle}</Text>

        <View style={styles.typeRow}>
          <Pill label={pm.educationForm.typeAcademic} selected={educationType === 'academic'} onPress={() => setEducationType('academic')} />
          <Pill label={pm.educationForm.typeCertification} selected={educationType === 'certification'} onPress={() => setEducationType('certification')} />
        </View>

        <TextField label={pm.educationForm.degreeLabel} value={degree} onChangeText={setDegree} />
        <TextField label={pm.educationForm.institutionLabel} value={institution} onChangeText={setInstitution} />
        <TextField label={pm.educationForm.fieldLabel} value={fieldOfStudy} onChangeText={setFieldOfStudy} />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <TextField label={pm.educationForm.startYearLabel} value={startYear} onChangeText={setStartYear} keyboardType="number-pad" />
          </View>
          <View style={styles.rowItem}>
            <TextField label={pm.educationForm.endYearLabel} value={endYear} onChangeText={setEndYear} keyboardType="number-pad" />
          </View>
        </View>

        <SelectField label={pm.educationForm.countryLabel} value={countryName} placeholder={pm.educationForm.countryLabel} onPress={countryModal.open} />
        <TextField label={pm.header.cityLabel} value={city} onChangeText={setCity} />
        <TextField label={pm.educationForm.credentialLabel} value={credentialUrl} onChangeText={setCredentialUrl} autoCapitalize="none" />
        <TextField
          label={pm.educationForm.descriptionLabel}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

        <FormActions onCancel={() => navigation.goBack()} onSubmit={submit} submitLabel={pm.common.save} saving={saving} />
      </ScrollView>

      <SearchPickerModal
        visible={countryModal.visible}
        title={pm.educationForm.countryLabel}
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
  typeRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  row: {
    flexDirection: 'row',
    gap: space[4],
  },
  rowItem: {
    flex: 1,
  },
  error: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
