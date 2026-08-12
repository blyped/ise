import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  loadAvailabilityDetails,
  loadAvailabilityTypes,
  saveAvailability,
  type AvailabilityChannel,
  type AvailabilityTypeOption,
  type VisibilityLevel,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import { Checkbox, ErrorBanner, FormActions, Hint, LoadingView, Pill, VisibilityPicker } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'AvailabilityEdit'>;

const CHANNELS: AvailabilityChannel[] = ['message', 'email', 'call', 'video'];

/** ISE-033 — Modifier ma disponibilité (D-73 : visibilité à 4 niveaux, agenda détaillé jamais affiché). */
export function AvailabilityEditScreen({ navigation }: Props) {
  const profileId = useProfileId();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [types, setTypes] = useState<AvailabilityTypeOption[]>([]);
  const [activeTypes, setActiveTypes] = useState<string[]>([]);
  const [maxPerMonth, setMaxPerMonth] = useState('');
  const [idealDelayDays, setIdealDelayDays] = useState('');
  const [preferredChannel, setPreferredChannel] = useState<AvailabilityChannel | undefined>(undefined);
  const [visibility, setVisibility] = useState<VisibilityLevel>('members');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    Promise.all([loadAvailabilityTypes(), loadAvailabilityDetails(profileId)]).then(([typesResult, detailsResult]) => {
      setLoading(false);
      if (!typesResult.ok) {
        setLoadError(typesResult.message);
        return;
      }
      setTypes(typesResult.data);
      if (detailsResult.ok) {
        const active = detailsResult.data.filter((row) => row.active);
        setActiveTypes(active.map((row) => row.code));
        const reference = active[0] ?? detailsResult.data[0];
        if (reference) {
          setMaxPerMonth(reference.maxPerMonth !== null ? String(reference.maxPerMonth) : '');
          setIdealDelayDays(reference.idealDelayDays !== null ? String(reference.idealDelayDays) : '');
          setPreferredChannel(reference.preferredChannel ?? undefined);
          setVisibility(reference.visibility);
          setNotes(reference.notes ?? '');
        }
      }
    });
  }, [profileId]);

  function toggleType(code: string) {
    setActiveTypes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  async function submit() {
    setSaving(true);
    setSaveError(null);
    const result = await saveAvailability(profileId, {
      activeTypes,
      maxPerMonth: maxPerMonth.trim() ? Number(maxPerMonth) : undefined,
      idealDelayDays: idealDelayDays.trim() ? Number(idealDelayDays) : undefined,
      preferredChannel,
      visibility,
      notes,
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
        <ErrorBanner title={pm.availabilityForm.errorTitle} correlationId={undefined} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{pm.availabilityForm.heading}</Text>
        <Text style={styles.subtitle}>{pm.availabilityForm.subtitle}</Text>

        <Text style={styles.sectionLabel}>{pm.availabilityForm.helpTitle}</Text>
        {types.map((type) => (
          <Checkbox
            key={type.code}
            label={type.name}
            description={type.description ?? undefined}
            checked={activeTypes.includes(type.code)}
            onToggle={() => toggleType(type.code)}
          />
        ))}

        <Text style={styles.sectionLabel}>{pm.availabilityForm.preferencesTitle}</Text>
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <TextField label={pm.availabilityForm.maxPerMonthLabel} value={maxPerMonth} onChangeText={setMaxPerMonth} keyboardType="number-pad" />
          </View>
          <View style={styles.rowItem}>
            <TextField label={pm.availabilityForm.idealDelayLabel} value={idealDelayDays} onChangeText={setIdealDelayDays} keyboardType="number-pad" />
          </View>
        </View>

        <View style={styles.channelBlock}>
          <Text style={styles.sectionLabel}>{pm.availabilityForm.channelLabel}</Text>
          <View style={styles.pillRow}>
            {CHANNELS.map((channel) => (
              <Pill
                key={channel}
                label={pm.availabilityForm.channel[channel]}
                selected={preferredChannel === channel}
                onPress={() => setPreferredChannel(channel)}
              />
            ))}
          </View>
        </View>

        <TextField label={pm.availabilityForm.notesLabel} value={notes} onChangeText={setNotes} multiline numberOfLines={3} />

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        <Hint tone="warning">{pm.availabilityForm.privacyHint}</Hint>

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

        <FormActions onCancel={() => navigation.goBack()} onSubmit={submit} submitLabel={pm.common.save} saving={saving} />
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
  sectionLabel: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: space[2],
  },
  row: {
    flexDirection: 'row',
    gap: space[4],
  },
  rowItem: {
    flex: 1,
  },
  channelBlock: {
    gap: space[2],
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  error: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
