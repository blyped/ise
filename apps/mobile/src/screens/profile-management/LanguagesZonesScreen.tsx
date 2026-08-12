import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  loadCountries,
  loadLanguages,
  loadLanguagesZones,
  loadTools,
  saveLanguagesZones,
  type CountryOption,
  type LanguageOption,
  type LanguageProficiency,
  type ToolOption,
  type ToolProficiency,
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
  Pill,
  SearchPickerModal,
  SectionTitle,
  useModalState,
} from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'LanguagesZones'>;

interface LangEntry {
  code: string;
  name: string;
  proficiency: LanguageProficiency;
}
interface ZoneEntry {
  code: string;
  name: string;
}
interface ToolEntry {
  id: number;
  name: string;
  proficiency: ToolProficiency | undefined;
}

const LANGUAGE_LEVELS: LanguageProficiency[] = ['basic', 'intermediate', 'professional', 'fluent', 'native'];
const TOOL_LEVELS: ToolProficiency[] = ['notion', 'intermediate', 'advanced', 'expert'];

type LoadState = { status: 'loading' } | { status: 'error'; correlationId: string } | { status: 'ready' };

/** ISE-027 — Langues de travail, zones d'expérience et outils déclarés. */
export function LanguagesZonesScreen({ navigation }: Props) {
  const profileId = useProfileId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [allLanguages, setAllLanguages] = useState<LanguageOption[]>([]);
  const [allCountries, setAllCountries] = useState<CountryOption[]>([]);
  const [allTools, setAllTools] = useState<ToolOption[]>([]);

  const [languages, setLanguages] = useState<LangEntry[]>([]);
  const [zones, setZones] = useState<ZoneEntry[]>([]);
  const [tools, setTools] = useState<ToolEntry[]>([]);

  const languageModal = useModalState();
  const zoneModal = useModalState();
  const toolModal = useModalState();

  const load = useCallback(() => {
    setState({ status: 'loading' });
    Promise.all([loadLanguagesZones(profileId), loadLanguages(), loadCountries(), loadTools()]).then(
      ([lz, languageOptions, countryOptions, toolOptions]) => {
        if (!lz.ok) {
          setState({ status: 'error', correlationId: lz.correlationId });
          return;
        }
        if (languageOptions.ok) setAllLanguages(languageOptions.data);
        if (countryOptions.ok) setAllCountries(countryOptions.data);
        if (toolOptions.ok) setAllTools(toolOptions.data);
        setLanguages(lz.data.languages.map((l) => ({ code: l.languageCode, name: l.name, proficiency: l.proficiency })));
        setZones(lz.data.geographies.map((g) => ({ code: g.countryCode, name: g.name })));
        setTools(lz.data.tools.map((t) => ({ id: t.toolId, name: t.name, proficiency: t.proficiency ?? undefined })));
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
    const result = await saveLanguagesZones(profileId, {
      languages: languages.map((l) => ({ languageCode: l.code, proficiency: l.proficiency })),
      countryCodes: zones.map((z) => z.code),
      tools: tools.map((t) => ({ toolId: t.id, proficiency: t.proficiency })),
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
        <ErrorBanner title={pm.languagesZones.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{pm.languagesZones.heading}</Text>
        <Text style={styles.subtitle}>{pm.languagesZones.subtitle}</Text>

        <View style={styles.sectionHeader}>
          <SectionTitle>{pm.languagesZones.languagesTitle}</SectionTitle>
          <Text style={styles.link} onPress={languageModal.open}>
            + {pm.languagesZones.addLanguage}
          </Text>
        </View>
        {languages.map((entry) => (
          <Card key={entry.code}>
            <View style={styles.rowHeader}>
              <Text style={styles.entryName}>{entry.name}</Text>
              <Text style={styles.remove} onPress={() => setLanguages((prev) => prev.filter((l) => l.code !== entry.code))}>
                {pm.common.delete}
              </Text>
            </View>
            <View style={styles.pillRow}>
              {LANGUAGE_LEVELS.map((level) => (
                <Pill
                  key={level}
                  label={pm.languagesZones.proficiency[level]}
                  selected={entry.proficiency === level}
                  onPress={() =>
                    setLanguages((prev) => prev.map((l) => (l.code === entry.code ? { ...l, proficiency: level } : l)))
                  }
                />
              ))}
            </View>
          </Card>
        ))}

        <View style={styles.sectionHeader}>
          <SectionTitle>{pm.languagesZones.zonesTitle}</SectionTitle>
          <Text style={styles.link} onPress={zoneModal.open}>
            + {pm.languagesZones.addZone}
          </Text>
        </View>
        {zones.map((entry) => (
          <Card key={entry.code}>
            <View style={styles.rowHeader}>
              <Text style={styles.entryName}>{entry.name}</Text>
              <Text style={styles.remove} onPress={() => setZones((prev) => prev.filter((z) => z.code !== entry.code))}>
                {pm.common.delete}
              </Text>
            </View>
          </Card>
        ))}

        <View style={styles.sectionHeader}>
          <SectionTitle>{pm.languagesZones.toolsTitle}</SectionTitle>
          <Text style={styles.link} onPress={toolModal.open}>
            + {pm.languagesZones.addTool}
          </Text>
        </View>
        {tools.map((entry) => (
          <Card key={entry.id}>
            <View style={styles.rowHeader}>
              <Text style={styles.entryName}>{entry.name}</Text>
              <Text style={styles.remove} onPress={() => setTools((prev) => prev.filter((t) => t.id !== entry.id))}>
                {pm.common.delete}
              </Text>
            </View>
            <View style={styles.pillRow}>
              {TOOL_LEVELS.map((level) => (
                <Pill
                  key={level}
                  label={pm.languagesZones.toolLevel[level]}
                  selected={entry.proficiency === level}
                  onPress={() => setTools((prev) => prev.map((t) => (t.id === entry.id ? { ...t, proficiency: level } : t)))}
                />
              ))}
            </View>
          </Card>
        ))}

        <Hint tone="warning">{pm.languagesZones.hint}</Hint>

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

        <FormActions onCancel={() => navigation.goBack()} onSubmit={submit} submitLabel={pm.common.save} saving={saving} />
      </ScrollView>

      <SearchPickerModal
        visible={languageModal.visible}
        title={pm.languagesZones.addLanguage}
        placeholder="Rechercher une langue…"
        query={languageModal.query}
        onQueryChange={languageModal.setQuery}
        onClose={languageModal.close}
        options={allLanguages
          .filter((l) => !languages.some((sel) => sel.code === l.code))
          .filter((l) => l.name.toLowerCase().includes(languageModal.query.toLowerCase()))
          .map((l) => ({ key: l.code, label: l.name }))}
        onSelect={(option) => {
          setLanguages((prev) => [...prev, { code: option.key, name: option.label, proficiency: 'intermediate' }]);
          languageModal.close();
        }}
      />
      <SearchPickerModal
        visible={zoneModal.visible}
        title={pm.languagesZones.addZone}
        placeholder="Rechercher un pays…"
        query={zoneModal.query}
        onQueryChange={zoneModal.setQuery}
        onClose={zoneModal.close}
        options={allCountries
          .filter((c) => !zones.some((sel) => sel.code === c.code))
          .filter((c) => c.name.toLowerCase().includes(zoneModal.query.toLowerCase()))
          .map((c) => ({ key: c.code, label: c.name }))}
        onSelect={(option) => {
          setZones((prev) => [...prev, { code: option.key, name: option.label }]);
          zoneModal.close();
        }}
      />
      <SearchPickerModal
        visible={toolModal.visible}
        title={pm.languagesZones.addTool}
        placeholder="Rechercher un outil…"
        query={toolModal.query}
        onQueryChange={toolModal.setQuery}
        onClose={toolModal.close}
        options={allTools
          .filter((t) => !tools.some((sel) => sel.id === t.id))
          .filter((t) => t.name.toLowerCase().includes(toolModal.query.toLowerCase()))
          .map((t) => ({ key: String(t.id), label: t.name }))}
        onSelect={(option) => {
          setTools((prev) => [...prev, { id: Number(option.key), name: option.label, proficiency: undefined }]);
          toolModal.close();
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space[2],
  },
  link: {
    ...textStyle.bodySm,
    color: colors.actionBlue,
    fontWeight: '600',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryName: {
    ...textStyle.bodySm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  remove: {
    ...textStyle.caption,
    color: colors.error,
    fontWeight: '600',
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
