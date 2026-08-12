import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  loadCountries,
  loadProject,
  saveProject,
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
  SearchPickerModal,
  SelectField,
  VisibilityPicker,
  useModalState,
} from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'ProjectForm'>;

/** ISE-026 — Ajouter / modifier un projet ou une réalisation. */
export function ProjectFormScreen({ route, navigation }: Props) {
  const projectId = route.params?.projectId;
  const profileId = useProfileId();
  const isEdit = projectId !== undefined;

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [organizationNameRaw, setOrganizationNameRaw] = useState('');
  const [role, setRole] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [countryCode, setCountryCode] = useState<string | undefined>(undefined);
  const [countryName, setCountryName] = useState<string | null>(null);
  const [summary, setSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [visibility, setVisibility] = useState<VisibilityLevel>('members');

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const countryModal = useModalState();

  useEffect(() => {
    loadCountries().then((result) => {
      if (result.ok) setCountries(result.data);
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;
    loadProject(profileId, projectId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      const row = result.data;
      if (!row) return;
      setTitle(row.title);
      setOrganizationNameRaw(row.organizationNameRaw ?? '');
      setRole(row.role ?? '');
      setStartDate(row.startDate ?? '');
      setEndDate(row.endDate ?? '');
      setCountryCode(row.countryCode ?? undefined);
      setCountryName(row.countryName);
      setSummary(row.summary ?? '');
      setOutcome(row.outcome ?? '');
      setLinkUrl(row.linkUrl ?? '');
      setVisibility(row.visibility);
    });
  }, [projectId, profileId]);

  async function submit() {
    setSaving(true);
    setSaveError(null);
    const result = await saveProject(profileId, {
      projectId,
      title,
      organizationNameRaw,
      role,
      countryCode,
      startDate,
      endDate,
      summary,
      outcome,
      linkUrl,
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
        <ErrorBanner title={pm.projectForm.errorTitle} correlationId={undefined} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{isEdit ? pm.projectForm.headingEdit : pm.projectForm.heading}</Text>
        <Text style={styles.subtitle}>{pm.projectForm.subtitle}</Text>

        <TextField label={pm.projectForm.titleLabel} value={title} onChangeText={setTitle} />
        <TextField label={pm.projectForm.organizationLabel} value={organizationNameRaw} onChangeText={setOrganizationNameRaw} />
        <TextField label={pm.projectForm.roleLabel} value={role} onChangeText={setRole} />

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <TextField label={pm.projectForm.startDateLabel} value={startDate} onChangeText={setStartDate} placeholder="2024-01-01" />
          </View>
          <View style={styles.rowItem}>
            <TextField label={pm.projectForm.endDateLabel} value={endDate} onChangeText={setEndDate} placeholder="2024-12-31" />
          </View>
        </View>

        <SelectField label={pm.projectForm.countryLabel} value={countryName} placeholder={pm.projectForm.countryLabel} onPress={countryModal.open} />

        <TextField label={pm.projectForm.summaryLabel} value={summary} onChangeText={setSummary} multiline numberOfLines={3} />
        <TextField label={pm.projectForm.outcomeLabel} value={outcome} onChangeText={setOutcome} multiline numberOfLines={2} />
        <TextField label={pm.projectForm.linkLabel} value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" />

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

        <FormActions onCancel={() => navigation.goBack()} onSubmit={submit} submitLabel={pm.common.save} saving={saving} />
      </ScrollView>

      <SearchPickerModal
        visible={countryModal.visible}
        title={pm.projectForm.countryLabel}
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
