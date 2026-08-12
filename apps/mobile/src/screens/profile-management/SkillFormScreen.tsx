import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  deleteProfileSkill,
  loadProfileSkill,
  saveProfileSkill,
  searchSkills,
  type SkillLevel,
  type SkillSearchResult,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import {
  ErrorBanner,
  FormActions,
  Hint,
  LoadingView,
  Pill,
  SearchPickerModal,
  SelectField,
  useModalState,
} from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'SkillForm'>;

const LEVELS: SkillLevel[] = ['notion', 'intermediate', 'advanced', 'expert'];

/** ISE-023 — Gérer une compétence. Niveau strictement DÉCLARATIF (D-75). */
export function SkillFormScreen({ route, navigation }: Props) {
  const skillId = route.params?.skillId;
  const profileId = useProfileId();
  const isEdit = skillId !== undefined;

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedSkillId, setSelectedSkillId] = useState<number | undefined>(skillId);
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
  const [level, setLevel] = useState<SkillLevel>('intermediate');
  const [yearsExperience, setYearsExperience] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [context, setContext] = useState('');

  const [skillResults, setSkillResults] = useState<SkillSearchResult[]>([]);
  const [skillSearchLoading, setSkillSearchLoading] = useState(false);
  const skillModal = useModalState();

  useEffect(() => {
    if (!skillId) return;
    loadProfileSkill(profileId, skillId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.message);
        return;
      }
      const row = result.data;
      if (!row) return;
      setSelectedSkillName(row.name);
      setLevel(row.level ?? 'intermediate');
      setYearsExperience(row.yearsExperience !== null ? String(row.yearsExperience) : '');
      setIsPrimary(row.isPrimary);
      setContext(row.context ?? '');
    });
  }, [skillId, profileId]);

  useEffect(() => {
    if (!skillModal.visible) return;
    setSkillSearchLoading(true);
    const timer = setTimeout(() => {
      searchSkills(skillModal.query).then((result) => {
        setSkillSearchLoading(false);
        if (result.ok) setSkillResults(result.data);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [skillModal.query, skillModal.visible]);

  async function submit() {
    if (!selectedSkillId) {
      setSaveError(pm.common.errorTitle);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await saveProfileSkill(profileId, {
      skillId: selectedSkillId,
      level,
      yearsExperience: yearsExperience.trim() ? Number(yearsExperience) : undefined,
      isPrimary,
      context,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    navigation.goBack();
  }

  function confirmDelete() {
    if (!selectedSkillId) return;
    Alert.alert(pm.skillForm.deleteAction, selectedSkillName ?? '', [
      { text: pm.common.cancel, style: 'cancel' },
      {
        text: pm.common.delete,
        style: 'destructive',
        onPress: () => {
          deleteProfileSkill(profileId, selectedSkillId).then((result) => {
            if (result.ok) navigation.goBack();
          });
        },
      },
    ]);
  }

  if (loading) return <Screen><LoadingView /></Screen>;
  if (loadError) {
    return (
      <Screen>
        <ErrorBanner title={pm.skillForm.errorTitle} correlationId={undefined} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{selectedSkillName ?? pm.skillForm.heading}</Text>
        <Text style={styles.subtitle}>{pm.skillForm.subtitle}</Text>

        {!isEdit ? (
          <SelectField
            label={pm.skillForm.searchLabel}
            value={selectedSkillName}
            placeholder={pm.skillForm.searchLabel}
            onPress={skillModal.open}
          />
        ) : null}

        <View style={styles.levelBlock}>
          <Text style={styles.sectionLabel}>{pm.skillForm.levelLabel}</Text>
          <View style={styles.levelRow}>
            {LEVELS.map((value) => (
              <Pill key={value} label={pm.skills.level[value]} selected={level === value} onPress={() => setLevel(value)} />
            ))}
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <TextField label={pm.skillForm.yearsLabel} value={yearsExperience} onChangeText={setYearsExperience} keyboardType="number-pad" />
          </View>
          <View style={styles.rowItem}>
            <View style={styles.primaryToggle}>
              <Text style={styles.primaryLabel}>{pm.skillForm.primaryLabel}</Text>
              <Switch value={isPrimary} onValueChange={setIsPrimary} accessibilityLabel={pm.skillForm.primaryLabel} />
            </View>
          </View>
        </View>

        <TextField
          label={pm.skillForm.contextLabel}
          value={context}
          onChangeText={setContext}
          multiline
          numberOfLines={3}
        />

        <Hint tone="warning">
          {pm.skillForm.declarativeNotice} {pm.skillForm.declarativeHint}
        </Hint>

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

        {isEdit ? (
          <Text style={styles.deleteLink} onPress={confirmDelete}>
            {pm.skillForm.deleteAction}
          </Text>
        ) : null}

        <FormActions onCancel={() => navigation.goBack()} onSubmit={submit} submitLabel={pm.common.save} saving={saving} />
      </ScrollView>

      <SearchPickerModal
        visible={skillModal.visible}
        title={pm.skillForm.searchLabel}
        placeholder={pm.skillForm.searchLabel}
        query={skillModal.query}
        onQueryChange={skillModal.setQuery}
        onClose={skillModal.close}
        loading={skillSearchLoading}
        options={skillResults.map((s) => ({ key: String(s.skillId), label: s.name, sublabel: s.categoryName }))}
        onSelect={(option) => {
          setSelectedSkillId(Number(option.key));
          setSelectedSkillName(option.label);
          skillModal.close();
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
  levelBlock: {
    gap: space[2],
  },
  sectionLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  levelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  row: {
    flexDirection: 'row',
    gap: space[4],
  },
  rowItem: {
    flex: 1,
  },
  primaryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: space[4],
    minHeight: 44,
  },
  primaryLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  error: {
    ...textStyle.bodySm,
    color: colors.error,
  },
  deleteLink: {
    ...textStyle.bodySm,
    color: colors.error,
    fontWeight: '700',
    textAlign: 'center',
  },
});
