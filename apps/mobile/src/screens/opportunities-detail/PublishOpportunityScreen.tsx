import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { frOpportunitiesDetail as t } from '../../i18n/opportunities-detail';
import { saveOpportunityDraft } from '../../lib/queries/opportunities-detail';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Badge } from './shared';

/**
 * ISE-057 — Publier une opportunité, étape 1 (l'offre).
 *
 * `save_opportunity_draft()` — même RPC que
 * `apps/web/src/app/opportunites/publier/page.tsx` (via `OfferForm` /
 * `saveOfferAction`). Les clés envoyées (`opportunity_type`,
 * `organization_name_raw`, `application_mode`…) sont EXACTEMENT celles
 * du payload web, pour que la même fonction serveur les interprète.
 *
 * Le visuel ISE-057 propose 4 types (« Emploi, Mission, Appel d'offres,
 * Partenariat »). Le vocabulaire des opportunités est FERMÉ par les
 * migrations 0007/0008 (`job | internship | mission | business |
 * research | scholarship`) : aucun type « Partenariat » n'existe côté
 * base, et `MVP_OPPORTUNITY_TYPES` (web) ne couvre même que job/
 * internship/mission. Plutôt que d'inventer une valeur, cet écran
 * propose les 4 types RÉELS les plus proches de l'intention du visuel
 * (Emploi, Mission, Business, Stage) avec leurs libellés officiels.
 *
 * Le champ unique « Lieu / pays » du visuel est envoyé dans `city` (pas
 * de découpage ville/pays sur cet écran, à la différence du formulaire
 * web complet) : `country_code` reste vide, ce que le RPC accepte.
 *
 * Les « compétences recherchées » du visuel sont un ajout libre de
 * jetons texte. La sélection réelle de compétences (ISE-058, catalogue
 * avec identifiants) exige une RPC de recherche non mandatée pour cette
 * tranche mobile (`searchOpportunitySkillsAction`, hors périmètre) : ces
 * jetons sont donc repris tels quels dans `summary`, jamais envoyés
 * comme `skill_id` fabriqués.
 */

const TYPE_OPTIONS = ['job', 'mission', 'business', 'internship'] as const;

export function PublishOpportunityScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: (opportunityId: string) => void;
}) {
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>('job');
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<'draft' | 'continue' | null>(null);

  const addSkill = () => {
    const value = skillInput.trim();
    if (value.length === 0) return;
    setSkills((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setSkillInput('');
  };

  const save = (mode: 'draft' | 'continue') => {
    if (title.trim().length < 3 || description.trim().length < 20) {
      setError(
        title.trim().length < 3
          ? t.wizard.titleLabel
          : t.wizard.descriptionLabel,
      );
      return;
    }
    setSaving(mode);
    setError(null);
    const summary =
      skills.length > 0 ? `${t.wizard.skillsLabel} : ${skills.join(', ')}`.slice(0, 400) : '';
    saveOpportunityDraft(null, {
      opportunity_type: type,
      contract_type: '',
      title: title.trim(),
      summary,
      description: description.trim(),
      organization_id: '',
      organization_name_raw: organization.trim(),
      country_code: '',
      city: location.trim(),
      remote_mode: '',
      remote_allowed: false,
      start_date: '',
      duration_days: '',
      deadline: '',
      positions_count: '1',
      compensation_min: '',
      compensation_max: '',
      currency: '',
      compensation_disclosed: false,
      application_mode: 'internal',
      external_application_url: '',
      external_application_email: '',
      contact_profile_id: '',
      suitable_for_new_graduates: false,
      visibility: 'members',
    })
      .then((result) => {
        setSaving(null);
        if (result.failed || result.data === null || result.data.length === 0) {
          setError(t.common.loadErrorTitle);
          return;
        }
        if (mode === 'draft') {
          onBack();
        } else {
          onContinue(result.data);
        }
      })
      .catch(() => {
        setSaving(null);
        setError(t.common.loadErrorTitle);
      });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.headerBack}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t.wizard.createTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{t.wizard.step1Title}</Text>
          <Text style={styles.subtitle}>{t.wizard.createSubtitle}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.legend}>{t.wizard.typeLegend}</Text>
          <View style={styles.typeGrid}>
            {TYPE_OPTIONS.map((value) => (
              <Pressable
                key={value}
                onPress={() => setType(value)}
                accessibilityRole="button"
                accessibilityState={{ selected: type === value }}
                style={[styles.typePill, type === value ? styles.typePillSelected : null]}
              >
                <Text style={[styles.typePillLabel, type === value ? styles.typePillLabelSelected : null]}>
                  {t.type[value] ?? value}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <TextField
          label={t.wizard.titleLabel}
          placeholder={t.wizard.titlePlaceholder}
          value={title}
          onChangeText={setTitle}
        />
        <TextField
          label={t.wizard.organizationLabel}
          placeholder={t.wizard.organizationLabel}
          value={organization}
          onChangeText={setOrganization}
        />
        <TextField
          label={t.wizard.locationLabel}
          placeholder={t.wizard.locationPlaceholder}
          value={location}
          onChangeText={setLocation}
        />

        <View style={styles.field}>
          <Text style={styles.legend}>{t.wizard.descriptionLabel}</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={6}
            placeholder={t.wizard.descriptionPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            accessibilityLabel={t.wizard.descriptionLabel}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.legend}>{t.wizard.skillsLabel}</Text>
          <View style={styles.skillRow}>
            <TextInput
              style={styles.skillInput}
              placeholder={t.wizard.skillsPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={skillInput}
              onChangeText={setSkillInput}
              onSubmitEditing={addSkill}
              accessibilityLabel={t.wizard.skillsLabel}
            />
            <Pressable onPress={addSkill} accessibilityRole="button" style={styles.addButton}>
              <Text style={styles.addButtonLabel}>+</Text>
            </Pressable>
          </View>
          {skills.length > 0 ? (
            <View style={styles.badgeRow}>
              {skills.map((skill) => (
                <Pressable
                  key={skill}
                  onPress={() => setSkills((prev) => prev.filter((item) => item !== skill))}
                  accessibilityRole="button"
                >
                  <Badge label={skill} tone="info" />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {error !== null ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => save('draft')}
          disabled={saving !== null}
          accessibilityRole="button"
          style={[styles.secondaryButton, saving !== null ? styles.disabled : null]}
        >
          {saving === 'draft' ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Text style={styles.secondaryButtonLabel}>{t.wizard.draft}</Text>
          )}
        </Pressable>
        <View style={styles.footerPrimary}>
          <Button label={t.wizard.continue} loading={saving === 'continue'} onPress={() => save('continue')} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: space[5],
    paddingTop: space[6],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space[5],
  },
  headerBack: {
    fontSize: 28,
    color: colors.textPrimary,
    width: 32,
  },
  headerTitle: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  scroll: {
    gap: space[5],
    paddingBottom: space[8],
  },
  titleBlock: {
    gap: space[1],
  },
  title: {
    ...textStyle.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  field: {
    gap: space[2],
  },
  legend: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
  },
  typePill: {
    minHeight: 44,
    minWidth: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: space[4],
  },
  typePillSelected: {
    borderColor: colors.actionBlue,
    borderWidth: 2,
    backgroundColor: colors.surfaceMuted,
  },
  typePillLabel: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  typePillLabelSelected: {
    color: colors.actionBlue,
  },
  textArea: {
    ...textStyle.bodySm,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    padding: space[4],
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  skillRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  skillInput: {
    ...textStyle.bodySm,
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: rounded.base,
    backgroundColor: colors.actionBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonLabel: {
    ...textStyle.h4,
    color: colors.textInverse,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  errorText: {
    ...textStyle.caption,
    color: colors.error,
  },
  footer: {
    flexDirection: 'row',
    gap: space[3],
    paddingTop: space[4],
    paddingBottom: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerPrimary: {
    flex: 1,
  },
  secondaryButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[6],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  disabled: {
    opacity: 0.6,
  },
  secondaryButtonLabel: {
    ...textStyle.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
