import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { frNetworkCalls, tcNetworkCalls } from '../../i18n/network-calls';
import {
  CALL_TYPES,
  HELP_TYPES,
  VISIBILITY_LEVELS,
  loadAudiencePreview,
  loadCountries,
  loadNetworkCall,
  loadPromotions,
  loadSectors,
  publishCall,
  saveCallDraft,
  searchCallSkills,
  type AudiencePreview,
  type CountryOption,
  type PromotionOption,
  type SectorOption,
  type SkillOption,
} from '../../lib/queries/network-calls';
import type { NetworkCallsStackParamList } from '../../navigation/NetworkCallsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<NetworkCallsStackParamList, 'AppelCreer'>;

interface SelectedSkill {
  skillId: string;
  name: string;
  importance: 'required' | 'preferred';
}

const TOTAL_STEPS = 4;

/**
 * ISE-049 -> ISE-052 — Assistant de creation d'un appel (coquille mobile).
 *
 * UN SEUL ecran porte les 4 etapes du wizard web (`nouveau` puis
 * `[callId]/besoin`, `/profil-recherche`, `/ciblage`, `/apercu`) : sur
 * mobile, un wizard plein ecran avec une barre de progression « 1/4 »
 * rend la meme promesse que 4 routes web (D26 §119). Chaque « Continuer »
 * appelle `save_network_call_draft` avec le sous-ensemble de champs de
 * son etape — EXACTEMENT le meme decoupage transactionnel que
 * `apps/web/src/app/appels/actions.ts` (`saveNeedAction`,
 * `saveWantedProfileAction`, `saveAudienceAction`).
 *
 * REDUCTION DE PERIMETRE ASSUMEE (etape 2) : outils et langues du profil
 * recherche restent hors de cette premiere tranche mobile — seuls
 * competences, secteur, pays principal et experience minimale sont
 * couverts. Meme logique que les reductions deja actees sur
 * `queries/network.ts` et `queries/opportunities.ts`.
 */
export function CreateNetworkCallScreen({ route, navigation }: Props) {
  const initialCallId = route.params?.callId ?? null;
  const [callId, setCallId] = useState<string | null>(initialCallId);
  const [step, setStep] = useState(1);
  const [loadingDraft, setLoadingDraft] = useState(initialCallId !== null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Etape 1
  const [callType, setCallType] = useState<string>('expert');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [deadline, setDeadline] = useState('');

  // Etape 2
  const [wantedProfile, setWantedProfile] = useState('');
  const [skills, setSkills] = useState<SelectedSkill[]>([]);
  const [skillQuery, setSkillQuery] = useState('');
  const [skillResults, setSkillResults] = useState<SkillOption[]>([]);
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [sectorRequired, setSectorRequired] = useState(false);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countryQuery, setCountryQuery] = useState('');
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [minExperience, setMinExperience] = useState('');
  const [helpTypes, setHelpTypes] = useState<string[]>([]);

  // Etape 3
  const [visibility, setVisibility] = useState<string>('members');
  const [hideOrganization, setHideOrganization] = useState(false);
  const [promotions, setPromotions] = useState<PromotionOption[]>([]);
  const [promotionQuery, setPromotionQuery] = useState('');
  const [audiencePromotionIds, setAudiencePromotionIds] = useState<string[]>([]);
  const [audience, setAudience] = useState<AudiencePreview | null>(null);

  // Recharger un brouillon existant.
  useEffect(() => {
    if (initialCallId === null) return;
    loadNetworkCall(initialCallId)
      .then((result) => {
        if (!result.failed && result.data !== null) {
          const call = result.data;
          setCallType(call.callType);
          setTitle(call.title);
          setDescription(call.description);
          setContext(call.context ?? '');
          setDeadline(call.deadline ?? '');
          setWantedProfile(call.wantedProfile ?? '');
          setSkills(
            call.skills.map((s) => ({ skillId: s.name, name: s.name, importance: s.importance })),
          );
          setMinExperience(call.minExperienceYears !== null ? String(call.minExperienceYears) : '');
          setHelpTypes([...call.helpTypes]);
          setVisibility(call.visibility);
        }
        setLoadingDraft(false);
      })
      .catch(() => setLoadingDraft(false));
  }, [initialCallId]);

  useEffect(() => {
    loadSectors().then((result) => {
      if (!result.failed && result.data !== null) setSectors(result.data);
    });
    loadCountries().then((result) => {
      if (!result.failed && result.data !== null) setCountries(result.data);
    });
    loadPromotions().then((result) => {
      if (!result.failed && result.data !== null) setPromotions(result.data);
    });
  }, []);

  useEffect(() => {
    if (skillQuery.trim().length < 2) {
      setSkillResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchCallSkills(skillQuery).then((result) => {
        if (!result.failed && result.data !== null) setSkillResults(result.data);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [skillQuery]);

  const refreshAudience = useCallback((id: string) => {
    loadAudiencePreview(id).then((result) => {
      if (!result.failed && result.data !== null) setAudience(result.data);
    });
  }, []);

  const saveStep1 = useCallback(() => {
    setError(null);
    if (title.trim().length < 3) {
      setError(frNetworkCalls.wizard.titleHint);
      return;
    }
    if (description.trim().length < 20) {
      setError(frNetworkCalls.wizard.descriptionHint);
      return;
    }
    setSaving(true);
    saveCallDraft(callId, {
      call_type: callType,
      title: title.trim(),
      description: description.trim(),
      context: context.trim(),
      deadline: deadline.trim(),
      visibility,
      hide_author_organization: hideOrganization,
    })
      .then((result) => {
        setSaving(false);
        if (result.failed || result.data === null || result.data.length === 0) {
          setError(frNetworkCalls.common.loadErrorTitle);
          return;
        }
        setCallId(result.data);
        setStep(2);
      })
      .catch(() => setSaving(false));
  }, [callId, callType, title, description, context, deadline, visibility, hideOrganization]);

  const saveStep2 = useCallback(() => {
    if (callId === null) return;
    setSaving(true);
    setError(null);
    saveCallDraft(callId, {
      wanted_profile: wantedProfile.trim(),
      sector_id: sectorId ?? '',
      sector_importance: sectorRequired ? 'required' : 'preferred',
      country_code: countryCode ?? '',
      min_experience_years: minExperience.trim(),
      skills: skills.map((s) => ({ skill_id: s.skillId, importance: s.importance })),
      help_types: helpTypes,
    })
      .then((result) => {
        setSaving(false);
        if (result.failed) {
          setError(frNetworkCalls.common.loadErrorTitle);
          return;
        }
        setStep(3);
      })
      .catch(() => setSaving(false));
  }, [callId, wantedProfile, sectorId, sectorRequired, countryCode, minExperience, skills, helpTypes]);

  const saveStep3 = useCallback(() => {
    if (callId === null) return;
    setSaving(true);
    setError(null);
    saveCallDraft(callId, {
      visibility,
      hide_author_organization: hideOrganization,
      audience_promotion_ids: audiencePromotionIds,
    })
      .then((result) => {
        setSaving(false);
        if (result.failed) {
          setError(frNetworkCalls.common.loadErrorTitle);
          return;
        }
        refreshAudience(callId);
        setStep(4);
      })
      .catch(() => setSaving(false));
  }, [callId, visibility, hideOrganization, audiencePromotionIds, refreshAudience]);

  const doPublish = useCallback(() => {
    if (callId === null) return;
    setPublishing(true);
    setError(null);
    publishCall(callId)
      .then((result) => {
        setPublishing(false);
        if (result.failed) {
          setError(frNetworkCalls.common.loadErrorTitle);
          return;
        }
        navigation.replace('AppelSuivi', { callId });
      })
      .catch(() => setPublishing(false));
  }, [callId, navigation]);

  if (loadingDraft) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      </Screen>
    );
  }

  const filteredCountries =
    countryQuery.trim().length > 0
      ? countries.filter((c) => c.name.toLowerCase().includes(countryQuery.trim().toLowerCase())).slice(0, 8)
      : [];
  const filteredPromotions =
    promotionQuery.trim().length > 0
      ? promotions.filter((p) => p.name.toLowerCase().includes(promotionQuery.trim().toLowerCase())).slice(0, 8)
      : [];
  const selectedCountry = countries.find((c) => c.code === countryCode) ?? null;
  const selectedPromotions = promotions.filter((p) => audiencePromotionIds.includes(String(p.id)));

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable onPress={navigation.goBack} accessibilityRole="button" style={styles.backBar}>
          <Text style={styles.backLabel}>{frNetworkCalls.common.back}</Text>
        </Pressable>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {tcNetworkCalls(frNetworkCalls.wizard.stepLabel, { current: step, total: TOTAL_STEPS })}
          </Text>
        </View>
        <Text style={styles.stepName}>
          {step === 1
            ? frNetworkCalls.wizard.step1
            : step === 2
              ? frNetworkCalls.wizard.step2
              : step === 3
                ? frNetworkCalls.wizard.step3
                : frNetworkCalls.wizard.step4}
        </Text>

        {error !== null ? <Text style={styles.errorText}>{error}</Text> : null}

        {step === 1 ? (
          <View style={styles.stepBody}>
            <Text style={styles.fieldLabel}>{frNetworkCalls.wizard.typeLabel}</Text>
            <View style={styles.chipWrap}>
              {CALL_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={frNetworkCalls.type[type] ?? type}
                  active={callType === type}
                  onPress={() => setCallType(type)}
                />
              ))}
            </View>

            <TextField
              label={frNetworkCalls.wizard.titleLabel}
              value={title}
              onChangeText={setTitle}
              placeholder={frNetworkCalls.wizard.titlePlaceholder}
              maxLength={120}
            />
            <TextField
              label={frNetworkCalls.wizard.descriptionLabel}
              value={description}
              onChangeText={setDescription}
              placeholder={frNetworkCalls.wizard.descriptionPlaceholder}
              multiline
              numberOfLines={5}
              style={styles.textArea}
            />
            <TextField
              label={frNetworkCalls.wizard.contextLabel}
              value={context}
              onChangeText={setContext}
              placeholder={frNetworkCalls.wizard.contextHint}
            />
            <TextField
              label={frNetworkCalls.wizard.deadlineLabel}
              value={deadline}
              onChangeText={setDeadline}
              placeholder="2026-09-30"
            />
            <Text style={styles.hint}>{frNetworkCalls.wizard.deadlineHint}</Text>

            <Button
              label={saving ? frNetworkCalls.common.savePending : frNetworkCalls.wizard.next}
              onPress={saveStep1}
              loading={saving}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.stepBody}>
            <Text style={styles.subtitle}>{frNetworkCalls.wizard.wantedSubtitle}</Text>
            <TextField
              label={frNetworkCalls.wizard.wantedProfileLabel}
              value={wantedProfile}
              onChangeText={setWantedProfile}
              placeholder={frNetworkCalls.wizard.wantedProfilePlaceholder}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />

            <Text style={styles.fieldLabel}>{frNetworkCalls.wizard.skillsLabel}</Text>
            <View style={styles.chipWrap}>
              {skills.map((skill) => (
                <Pressable
                  key={skill.skillId}
                  style={[styles.chip, styles.chipActive]}
                  onPress={() =>
                    setSkills((prev) =>
                      prev.map((s) =>
                        s.skillId === skill.skillId
                          ? { ...s, importance: s.importance === 'required' ? 'preferred' : 'required' }
                          : s,
                      ),
                    )
                  }
                  onLongPress={() => setSkills((prev) => prev.filter((s) => s.skillId !== skill.skillId))}
                >
                  <Text style={styles.chipActiveLabel}>
                    {skill.name} · {skill.importance === 'required' ? frNetworkCalls.common.required : frNetworkCalls.common.preferred}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextField
              label=""
              value={skillQuery}
              onChangeText={setSkillQuery}
              placeholder={frNetworkCalls.wizard.skillsSearchPlaceholder}
            />
            {skillResults.length > 0 ? (
              <View style={styles.chipWrap}>
                {skillResults.map((option) => (
                  <Chip
                    key={option.skillId}
                    label={option.name}
                    active={false}
                    onPress={() => {
                      setSkills((prev) =>
                        prev.some((s) => s.skillId === String(option.skillId))
                          ? prev
                          : [...prev, { skillId: String(option.skillId), name: option.name, importance: 'preferred' }],
                      );
                      setSkillQuery('');
                      setSkillResults([]);
                    }}
                  />
                ))}
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>{frNetworkCalls.wizard.sectorLabel}</Text>
            <View style={styles.chipWrap}>
              {sectors.map((sector) => (
                <Chip
                  key={sector.id}
                  label={sector.name}
                  active={sectorId === String(sector.id)}
                  onPress={() => setSectorId(sectorId === String(sector.id) ? null : String(sector.id))}
                />
              ))}
            </View>
            {sectorId !== null ? (
              <Checkbox
                label={frNetworkCalls.wizard.sectorRequiredLabel}
                checked={sectorRequired}
                onToggle={() => setSectorRequired((v) => !v)}
              />
            ) : null}

            <Text style={styles.fieldLabel}>{frNetworkCalls.wizard.countryLabel}</Text>
            {selectedCountry !== null ? (
              <Chip label={selectedCountry.name} active onPress={() => setCountryCode(null)} />
            ) : (
              <>
                <TextField label="" value={countryQuery} onChangeText={setCountryQuery} placeholder={frNetworkCalls.wizard.countryLabel} />
                <View style={styles.chipWrap}>
                  {filteredCountries.map((country) => (
                    <Chip
                      key={country.code}
                      label={country.name}
                      active={false}
                      onPress={() => {
                        setCountryCode(country.code);
                        setCountryQuery('');
                      }}
                    />
                  ))}
                </View>
              </>
            )}

            <TextField
              label={frNetworkCalls.wizard.minExperienceLabel}
              value={minExperience}
              onChangeText={setMinExperience}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>{frNetworkCalls.wizard.helpTypesLegend}</Text>
            <View style={styles.chipWrap}>
              {HELP_TYPES.map((type) => (
                <Chip
                  key={type}
                  label={frNetworkCalls.helpType[type] ?? type}
                  active={helpTypes.includes(type)}
                  onPress={() =>
                    setHelpTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
                  }
                />
              ))}
            </View>

            <View style={styles.stepNav}>
              <Pressable onPress={() => setStep(1)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonLabel}>{frNetworkCalls.wizard.previous}</Text>
              </Pressable>
              <View style={styles.stepNavPrimary}>
                <Button
                  label={saving ? frNetworkCalls.common.savePending : frNetworkCalls.wizard.next}
                  onPress={saveStep2}
                  loading={saving}
                />
              </View>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.stepBody}>
            <Text style={styles.subtitle}>{frNetworkCalls.wizard.audienceSubtitle}</Text>
            <Text style={styles.fieldLabel}>{frNetworkCalls.wizard.visibilityLegend}</Text>
            <View style={styles.chipWrap}>
              {VISIBILITY_LEVELS.map((level) => (
                <Chip
                  key={level}
                  label={frNetworkCalls.visibility[level] ?? level}
                  active={visibility === level}
                  onPress={() => setVisibility(level)}
                />
              ))}
            </View>
            <Checkbox
              label={frNetworkCalls.wizard.hideOrganizationLabel}
              checked={hideOrganization}
              onToggle={() => setHideOrganization((v) => !v)}
            />

            <Text style={styles.fieldLabel}>{frNetworkCalls.wizard.audiencePromotionsLabel}</Text>
            <View style={styles.chipWrap}>
              {selectedPromotions.map((promotion) => (
                <Chip
                  key={promotion.id}
                  label={promotion.name}
                  active
                  onPress={() =>
                    setAudiencePromotionIds((prev) => prev.filter((id) => id !== String(promotion.id)))
                  }
                />
              ))}
            </View>
            <TextField label="" value={promotionQuery} onChangeText={setPromotionQuery} placeholder={frNetworkCalls.wizard.audiencePromotionsLabel} />
            {filteredPromotions.length > 0 ? (
              <View style={styles.chipWrap}>
                {filteredPromotions.map((promotion) => (
                  <Chip
                    key={promotion.id}
                    label={promotion.name}
                    active={false}
                    onPress={() => {
                      setAudiencePromotionIds((prev) =>
                        prev.includes(String(promotion.id)) ? prev : [...prev, String(promotion.id)],
                      );
                      setPromotionQuery('');
                    }}
                  />
                ))}
              </View>
            ) : null}

            <View style={styles.stepNav}>
              <Pressable onPress={() => setStep(2)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonLabel}>{frNetworkCalls.wizard.previous}</Text>
              </Pressable>
              <View style={styles.stepNavPrimary}>
                <Button
                  label={saving ? frNetworkCalls.common.savePending : frNetworkCalls.wizard.next}
                  onPress={saveStep3}
                  loading={saving}
                />
              </View>
            </View>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.stepBody}>
            <Text style={styles.subtitle}>{frNetworkCalls.wizard.previewSubtitle}</Text>

            <View style={styles.audienceBox}>
              <Text style={styles.fieldLabel}>{frNetworkCalls.wizard.audienceComputed}</Text>
              {audience === null || audience.total === 0 ? (
                <Text style={styles.hint}>{frNetworkCalls.wizard.audienceEmptyBody}</Text>
              ) : (
                <>
                  <Text style={styles.audienceTotal}>
                    {tcNetworkCalls(frNetworkCalls.wizard.audienceTotal, { count: audience.total })}
                  </Text>
                  <Text style={styles.hint}>
                    {frNetworkCalls.wizard.audienceVeryRelevant} : {audience.veryRelevant} ·{' '}
                    {frNetworkCalls.wizard.audienceRelevant} : {audience.relevant} ·{' '}
                    {frNetworkCalls.wizard.audienceClose} : {audience.closeProfile}
                  </Text>
                </>
              )}
            </View>

            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>{title}</Text>
              <Text style={styles.paragraph}>{description}</Text>
              <Text style={styles.hint}>{frNetworkCalls.type[callType] ?? callType}</Text>
            </View>

            <View style={styles.stepNav}>
              <Pressable onPress={() => setStep(3)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonLabel}>{frNetworkCalls.wizard.previous}</Text>
              </Pressable>
              <View style={styles.stepNavPrimary}>
                <Button
                  label={publishing ? frNetworkCalls.wizard.publishPending : frNetworkCalls.wizard.publish}
                  onPress={doPublish}
                  loading={publishing}
                />
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.chipActive : null]}>
      <Text style={[styles.chipLabel, active ? styles.chipActiveLabel : null]}>{label}</Text>
    </Pressable>
  );
}

function Checkbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={styles.checkboxRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.checkboxBox, checked ? styles.checkboxBoxChecked : null]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBar: { marginBottom: space[3] },
  backLabel: { ...textStyle.bodySm, color: colors.actionBlue, fontWeight: '600' },
  progressRow: { marginBottom: space[1] },
  progressLabel: { ...textStyle.caption, color: colors.actionBlue, fontWeight: '700' },
  stepName: { ...textStyle.h3, fontWeight: '700', color: colors.textPrimary, marginBottom: space[5] },
  subtitle: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[4] },
  errorText: { ...textStyle.bodySm, color: colors.error, marginBottom: space[4] },
  stepBody: { gap: space[4], paddingBottom: space[10] },
  fieldLabel: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  hint: { ...textStyle.caption, color: colors.textMuted },
  paragraph: { ...textStyle.bodySm, color: colors.textSecondary },
  textArea: { minHeight: 96, textAlignVertical: 'top', paddingTop: space[3] },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: rounded.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.actionBlue, borderColor: colors.actionBlue },
  chipLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '600' },
  chipActiveLabel: { ...textStyle.caption, color: colors.textInverse, fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: rounded.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: { backgroundColor: colors.actionBlue, borderColor: colors.actionBlue },
  checkboxMark: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
  checkboxLabel: { ...textStyle.bodySm, color: colors.textPrimary, flexShrink: 1 },
  stepNav: { flexDirection: 'row', alignItems: 'center', gap: space[4], marginTop: space[3] },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: space[5],
    borderRadius: rounded.base,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonLabel: { ...textStyle.bodySm, color: colors.textPrimary, fontWeight: '600' },
  stepNavPrimary: { flex: 1 },
  audienceBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.base,
    padding: space[4],
    gap: space[1],
  },
  audienceTotal: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    gap: space[2],
  },
  previewTitle: { ...textStyle.body, fontWeight: '700', color: colors.textPrimary },
});
