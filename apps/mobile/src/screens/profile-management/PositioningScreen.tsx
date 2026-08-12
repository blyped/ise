import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  loadExpertiseAreas,
  loadJobFunctions,
  loadPositioning,
  loadSectors,
  savePositioning,
  type ExpertiseAreaOption,
  type JobFunctionOption,
  type SectorOption,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import {
  Card,
  ErrorBanner,
  FormActions,
  Hint,
  LoadingView,
  RemovableTag,
  SearchPickerModal,
  SectionTitle,
  useModalState,
} from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'Positioning'>;

interface Entry {
  id: number;
  name: string;
}

type LoadState = { status: 'loading' } | { status: 'error'; correlationId: string } | { status: 'ready' };

/** ISE-024 — Secteurs, fonctions & expertises (positionnement déclaré). */
export function PositioningScreen({ navigation }: Props) {
  const profileId = useProfileId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [allSectors, setAllSectors] = useState<SectorOption[]>([]);
  const [allFunctions, setAllFunctions] = useState<JobFunctionOption[]>([]);
  const [allExpertise, setAllExpertise] = useState<ExpertiseAreaOption[]>([]);

  const [sectors, setSectors] = useState<Entry[]>([]);
  const [primarySectorId, setPrimarySectorId] = useState<number | undefined>(undefined);
  const [functions, setFunctions] = useState<Entry[]>([]);
  const [expertise, setExpertise] = useState<Entry[]>([]);

  const sectorModal = useModalState();
  const functionModal = useModalState();
  const expertiseModal = useModalState();

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([loadPositioning(profileId), loadSectors(), loadJobFunctions(), loadExpertiseAreas()]).then(
      ([positioning, sectorOptions, functionOptions, expertiseOptions]) => {
        if (!positioning.ok) {
          setState({ status: 'error', correlationId: positioning.correlationId });
          return;
        }
        if (sectorOptions.ok) setAllSectors(sectorOptions.data);
        if (functionOptions.ok) setAllFunctions(functionOptions.data);
        if (expertiseOptions.ok) setAllExpertise(expertiseOptions.data);
        setSectors(positioning.data.sectors.map((s) => ({ id: s.sectorId, name: s.name })));
        setPrimarySectorId(positioning.data.sectors.find((s) => s.isPrimary)?.sectorId);
        setFunctions(positioning.data.functions.map((f) => ({ id: f.jobFunctionId, name: f.name })));
        setExpertise(positioning.data.expertiseAreas.map((e) => ({ id: e.expertiseAreaId, name: e.name })));
        setState({ status: 'ready' });
      },
    );
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    setSaving(true);
    setSaveError(null);
    const result = await savePositioning(profileId, {
      sectorIds: sectors.map((s) => s.id),
      primarySectorId,
      functionIds: functions.map((f) => f.id),
      expertiseAreaIds: expertise.map((e) => e.id),
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    navigation.goBack();
  }

  if (state.status === 'loading') return <Screen><LoadingView /></Screen>;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorBanner title={pm.positioning.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{pm.positioning.heading}</Text>
        <Text style={styles.subtitle}>{pm.positioning.subtitle}</Text>

        <Hint>
          {pm.positioning.notice} — {pm.positioning.noticeHint}
        </Hint>

        <Card>
          <View style={styles.cardHeader}>
            <SectionTitle>{pm.positioning.sectorsTitle}</SectionTitle>
            <Text style={styles.link} onPress={sectorModal.open}>
              + {pm.common.edit}
            </Text>
          </View>
          <View style={styles.tagsRow}>
            {sectors.map((s) => (
              <RemovableTag
                key={s.id}
                label={s.id === primarySectorId ? `★ ${s.name}` : s.name}
                onRemove={() => {
                  setSectors((prev) => prev.filter((x) => x.id !== s.id));
                  if (primarySectorId === s.id) setPrimarySectorId(undefined);
                }}
              />
            ))}
          </View>
        </Card>

        <Card>
          <View style={styles.cardHeader}>
            <SectionTitle>{pm.positioning.functionsTitle}</SectionTitle>
            <Text style={styles.link} onPress={functionModal.open}>
              + {pm.common.edit}
            </Text>
          </View>
          <View style={styles.tagsRow}>
            {functions.map((f) => (
              <RemovableTag key={f.id} label={f.name} onRemove={() => setFunctions((prev) => prev.filter((x) => x.id !== f.id))} />
            ))}
          </View>
        </Card>

        <Card>
          <View style={styles.cardHeader}>
            <SectionTitle>{pm.positioning.expertiseTitle}</SectionTitle>
            <Text style={styles.link} onPress={expertiseModal.open}>
              + {pm.common.edit}
            </Text>
          </View>
          <View style={styles.tagsRow}>
            {expertise.map((e) => (
              <RemovableTag key={e.id} label={e.name} onRemove={() => setExpertise((prev) => prev.filter((x) => x.id !== e.id))} />
            ))}
          </View>
        </Card>

        <Hint tone="success">{pm.positioning.reminderTitle} {pm.positioning.reminderHint}</Hint>

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

        <FormActions onCancel={() => navigation.goBack()} onSubmit={submit} submitLabel={pm.common.save} saving={saving} />
      </ScrollView>

      <SearchPickerModal
        visible={sectorModal.visible}
        title={pm.positioning.sectorsTitle}
        placeholder="Rechercher un secteur…"
        query={sectorModal.query}
        onQueryChange={sectorModal.setQuery}
        onClose={sectorModal.close}
        options={allSectors
          .filter((s) => !sectors.some((sel) => sel.id === s.id))
          .filter((s) => s.name.toLowerCase().includes(sectorModal.query.toLowerCase()))
          .map((s) => ({ key: String(s.id), label: s.name }))}
        onSelect={(option) => {
          const id = Number(option.key);
          setSectors((prev) => [...prev, { id, name: option.label }]);
          if (primarySectorId === undefined) setPrimarySectorId(id);
          sectorModal.close();
        }}
      />
      <SearchPickerModal
        visible={functionModal.visible}
        title={pm.positioning.functionsTitle}
        placeholder="Rechercher une fonction…"
        query={functionModal.query}
        onQueryChange={functionModal.setQuery}
        onClose={functionModal.close}
        options={allFunctions
          .filter((f) => !functions.some((sel) => sel.id === f.id))
          .filter((f) => f.name.toLowerCase().includes(functionModal.query.toLowerCase()))
          .map((f) => ({ key: String(f.id), label: f.name }))}
        onSelect={(option) => {
          setFunctions((prev) => [...prev, { id: Number(option.key), name: option.label }]);
          functionModal.close();
        }}
      />
      <SearchPickerModal
        visible={expertiseModal.visible}
        title={pm.positioning.expertiseTitle}
        placeholder="Rechercher une expertise…"
        query={expertiseModal.query}
        onQueryChange={expertiseModal.setQuery}
        onClose={expertiseModal.close}
        options={allExpertise
          .filter((e) => !expertise.some((sel) => sel.id === e.id))
          .filter((e) => e.name.toLowerCase().includes(expertiseModal.query.toLowerCase()))
          .map((e) => ({ key: String(e.id), label: e.name }))}
        onSelect={(option) => {
          setExpertise((prev) => [...prev, { id: Number(option.key), name: option.label }]);
          expertiseModal.close();
        }}
      />
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  link: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  error: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
