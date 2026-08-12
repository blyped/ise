import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { profileManagement as pm } from '../../i18n/profile-management';
import {
  requestRecommendation,
  searchConnections,
  searchSkills,
  type ConnectionOption,
  type RequestRecommendationInput,
  type SkillSearchResult,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import { FormActions, Hint, Pill, SearchPickerModal, SelectField, useModalState } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'RequestRecommendation'>;

type Relationship = RequestRecommendationInput['relationship'];
const RELATIONSHIPS: Relationship[] = ['project', 'mission', 'management', 'other'];

/** ISE-029 — Demander une recommandation (une demande individuelle à la fois). */
export function RequestRecommendationScreen({ navigation }: Props) {
  const profileId = useProfileId();
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [skillId, setSkillId] = useState<number | undefined>(undefined);
  const [skillName, setSkillName] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<Relationship>('project');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [connectionResults, setConnectionResults] = useState<ConnectionOption[]>([]);
  const [skillResults, setSkillResults] = useState<SkillSearchResult[]>([]);
  const memberModal = useModalState();
  const skillModal = useModalState();

  function runMemberSearch(query: string) {
    memberModal.setQuery(query);
    searchConnections(query).then((result) => {
      if (result.ok) setConnectionResults(result.data);
    });
  }

  function runSkillSearch(query: string) {
    skillModal.setQuery(query);
    searchSkills(query).then((result) => {
      if (result.ok) setSkillResults(result.data);
    });
  }

  async function submit() {
    if (!recipientId) {
      setError(pm.requestRecommendation.memberLabel);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await requestRecommendation(profileId, {
      recipientProfileId: recipientId,
      skillId,
      relationship,
      context,
      message,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigation.goBack();
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{pm.requestRecommendation.heading}</Text>
        <Text style={styles.subtitle}>{pm.requestRecommendation.subtitle}</Text>

        <SelectField
          label={pm.requestRecommendation.memberLabel}
          value={recipientName}
          placeholder={pm.requestRecommendation.memberSearchPlaceholder}
          onPress={() => {
            runMemberSearch('');
            memberModal.open();
          }}
        />

        <TextField label={pm.requestRecommendation.contextLabel} value={context} onChangeText={setContext} />

        <SelectField
          label={pm.requestRecommendation.skillLabel}
          value={skillName}
          placeholder={pm.requestRecommendation.skillLabel}
          onPress={() => {
            runSkillSearch('');
            skillModal.open();
          }}
        />

        <View style={styles.relationshipBlock}>
          <Text style={styles.sectionLabel}>{pm.requestRecommendation.relationshipLabel}</Text>
          <View style={styles.pillRow}>
            {RELATIONSHIPS.map((value) => (
              <Pill
                key={value}
                label={pm.requestRecommendation.relationship[value]}
                selected={relationship === value}
                onPress={() => setRelationship(value)}
              />
            ))}
          </View>
        </View>

        <TextField
          label={pm.requestRecommendation.messageLabel}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={4}
        />

        <Hint tone="success">{pm.requestRecommendation.hint}</Hint>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FormActions
          onCancel={() => navigation.goBack()}
          onSubmit={submit}
          submitLabel={pm.requestRecommendation.submit}
          saving={saving}
        />
      </ScrollView>

      <SearchPickerModal
        visible={memberModal.visible}
        title={pm.requestRecommendation.memberLabel}
        placeholder={pm.requestRecommendation.memberSearchPlaceholder}
        query={memberModal.query}
        onQueryChange={runMemberSearch}
        onClose={memberModal.close}
        options={connectionResults.map((c) => ({ key: c.profileId, label: c.displayName, sublabel: c.headline ?? undefined }))}
        onSelect={(option) => {
          setRecipientId(option.key);
          setRecipientName(option.label);
          memberModal.close();
        }}
      />
      <SearchPickerModal
        visible={skillModal.visible}
        title={pm.requestRecommendation.skillLabel}
        placeholder={pm.requestRecommendation.skillLabel}
        query={skillModal.query}
        onQueryChange={runSkillSearch}
        onClose={skillModal.close}
        options={skillResults.map((s) => ({ key: String(s.skillId), label: s.name, sublabel: s.categoryName }))}
        onSelect={(option) => {
          setSkillId(Number(option.key));
          setSkillName(option.label);
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
  relationshipBlock: {
    gap: space[2],
  },
  sectionLabel: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
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
