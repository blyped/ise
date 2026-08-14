import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frOpportunitiesDetail as t } from '../../i18n/opportunities-detail';
import { newCorrelationId } from '../../lib/correlation';
import { publicMediaUrl } from '../../lib/media';
import {
  declareExternalApplication,
  getOpportunity,
  recordOutboundClick,
  submitApplication,
  toggleSavedOpportunity,
  type OpportunityDetail,
} from '../../lib/queries/opportunities-detail';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import { Badge, Card, CardTitle, SecondaryButton } from './shared';

/**
 * ISE-056 — Détail d'une opportunité.
 *
 * `get_opportunity()` — même RPC que `apps/web/src/app/opportunites/[id]/page.tsx`.
 *
 * Le CTA « Voir comment postuler » ouvre, sur cet écran même, le panneau
 * qui porte la règle cardinale (MASTER PROMPT §27, D-55) : équivalent
 * mobile de `apps/web/src/app/opportunites/[id]/postuler/page.tsx`, sans
 * route dédiée puisqu'aucun numéro ISE ne lui est propre. Trois chemins
 * jamais confondus y cohabitent — candidature interne, déclaration externe
 * explicite avec date saisie par le membre, et clic sortant journalisé
 * (jamais une candidature).
 *
 * La carte « Votre réseau peut vous aider » du visuel (ISE-056) n'est PAS
 * reproduite : aucune RPC mobile ne fournit « les ISE liés à cette
 * organisation » dans le périmètre confié à cette tranche — inventer ces
 * données irait à l'encontre de la règle « aucune mesure fabriquée ».
 */
export function OpportunityDetailScreen({
  opportunityId,
  onBack,
  onOpenApplication,
}: {
  opportunityId: string;
  onBack: () => void;
  onOpenApplication: (applicationId: string) => void;
}) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; correlationId: string }
    | { status: 'ready'; opportunity: OpportunityDetail }
  >({ status: 'loading' });
  const [applyOpen, setApplyOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    getOpportunity(opportunityId)
      .then((result) => {
        if (result.failed || result.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({ status: 'ready', opportunity: result.data });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [opportunityId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleSaved = useCallback(() => {
    if (state.status !== 'ready' || saving) return;
    const nextSaved = !state.opportunity.isSaved;
    setSaving(true);
    toggleSavedOpportunity(opportunityId, nextSaved)
      .then((result) => {
        setSaving(false);
        if (result.failed || state.status !== 'ready') return;
        setState({ status: 'ready', opportunity: { ...state.opportunity, isSaved: nextSaved } });
      })
      .catch(() => setSaving(false));
  }, [opportunityId, saving, state]);

  if (state.status === 'loading') {
    return (
      <Screen>
        <Header onBack={onBack} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <Header onBack={onBack} />
        <ErrorState title={t.detail.notFoundTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  const opportunity = state.opportunity;
  const typeLabel = t.type[opportunity.opportunityType] ?? opportunity.opportunityType;
  const relevanceLabel =
    opportunity.relevance?.label !== null && opportunity.relevance?.label !== undefined
      ? (t.relevance[opportunity.relevance.label] ?? opportunity.relevance.label)
      : null;
  const location = [opportunity.city, opportunity.country].filter(Boolean).join(', ');
  const details = [
    opportunity.durationDays !== null ? `${opportunity.durationDays} jours` : null,
    opportunity.remoteMode !== null ? t.remoteMode[opportunity.remoteMode] ?? opportunity.remoteMode : null,
    opportunity.startDate,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');

  const alreadyEngaged = opportunity.myApplication !== null;
  const isClosed = opportunity.status !== 'active' && opportunity.status !== 'paused';
  // Visuel de l'offre : MÊME média que l'encart d'accueil et que le web
  // (`opportunities.cover_media_id`, D-166). Aucune « version mobile »
  // téléversée à part — une seule image par contenu (D-172).
  const coverUrl = publicMediaUrl(opportunity.cover);

  return (
    <Screen>
      <Header onBack={onBack} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Sans visuel, rien n'est rendu — jamais un cadre vide en attente. */}
        {coverUrl === null || opportunity.cover === null ? null : (
          <Image
            source={{ uri: coverUrl }}
            style={styles.cover}
            resizeMode="cover"
            accessible
            accessibilityRole="image"
            accessibilityLabel={opportunity.cover.alt}
          />
        )}

        <Card>
          <View style={styles.badgeRow}>
            <Badge label={typeLabel} tone="info" />
            {relevanceLabel !== null ? <Badge label={relevanceLabel} tone="success" /> : null}
          </View>
          <Text style={styles.title}>{opportunity.title}</Text>
          <Text style={styles.subtitle}>
            {[opportunity.organization, location].filter(Boolean).join(' · ')}
          </Text>
          {details.length > 0 ? <Text style={styles.meta}>{details}</Text> : null}
          {opportunity.deadline !== null ? (
            <Text style={styles.deadline}>
              {t.detail.deadlineLabel} : {opportunity.deadline}
            </Text>
          ) : null}

          {opportunity.isManager ? (
            <Card tone="info">
              <CardTitle>{t.detail.manageTitle}</CardTitle>
            </Card>
          ) : alreadyEngaged && opportunity.myApplication !== null ? (
            <Button
              label={t.detail.seeApplication}
              onPress={() => onOpenApplication((opportunity.myApplication as NonNullable<typeof opportunity.myApplication>).applicationId)}
            />
          ) : isClosed ? (
            <Card tone="warning">
              <CardTitle>{t.detail.closedTitle}</CardTitle>
              <Text style={styles.cardBody}>{t.detail.closedBody}</Text>
            </Card>
          ) : (
            <Button
              label={applyOpen ? t.detail.howToApplyCta : t.detail.howToApplyCta}
              onPress={() => setApplyOpen((open) => !open)}
            />
          )}
        </Card>

        {opportunity.relevance !== null && opportunity.relevance.reasons.length > 0 ? (
          <Card tone="success">
            <CardTitle tone="success">{t.detail.whyTitle}</CardTitle>
            {opportunity.relevance.reasons.map((reason, index) => (
              <Text key={`${reason.criterion}-${index}`} style={styles.reasonLine}>
                ✓ {reason.label}
              </Text>
            ))}
          </Card>
        ) : null}

        <Card>
          <CardTitle>{t.detail.aboutTitle}</CardTitle>
          <Text style={styles.cardBody}>{opportunity.description}</Text>
        </Card>

        {opportunity.skills.length > 0 ? (
          <Card>
            <CardTitle>Compétences</CardTitle>
            <View style={styles.badgeRow}>
              {opportunity.skills.map((skill) => (
                <Badge key={skill.name} label={skill.name} tone={skill.importance === 'required' ? 'purple' : 'neutral'} />
              ))}
            </View>
          </Card>
        ) : null}

        {applyOpen && !opportunity.isManager && !alreadyEngaged && !isClosed ? (
          <ApplyPanel
            opportunity={opportunity}
            onApplied={(applicationId) => onOpenApplication(applicationId)}
          />
        ) : null}
      </ScrollView>

      {!opportunity.isManager && !alreadyEngaged && !isClosed ? (
        <View style={styles.footer}>
          <SecondaryButton
            label={opportunity.isSaved ? t.detail.unsave : t.detail.save}
            onPress={handleToggleSaved}
            disabled={saving}
          />
          <View style={styles.footerPrimary}>
            <Button label={t.detail.howToApplyCta} onPress={() => setApplyOpen(true)} />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * Panneau « Comment postuler » — équivalent mobile de la page web
 * `/opportunites/[id]/postuler`. Voir la note de tête de fichier : c'est
 * ICI, et nulle part ailleurs, que D-55 est appliquée pour ISE-056.
 */
function ApplyPanel({
  opportunity,
  onApplied,
}: {
  opportunity: OpportunityDetail;
  onApplied: (applicationId: string) => void;
}) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clickRecorded, setClickRecorded] = useState(false);
  const [declareOpen, setDeclareOpen] = useState(false);
  const [declaredDate, setDeclaredDate] = useState('');
  const [declareNote, setDeclareNote] = useState('');
  const [declaring, setDeclaring] = useState(false);

  if (opportunity.canApplyInternally) {
    return (
      <Card>
        <CardTitle>{t.apply.titleInternal}</CardTitle>
        <Text style={styles.cardBody}>{t.apply.subtitleInternal}</Text>
        <TextInput
          style={styles.textArea}
          multiline
          numberOfLines={4}
          placeholder={t.apply.messagePlaceholder}
          placeholderTextColor={colors.textMuted}
          value={message}
          onChangeText={setMessage}
          accessibilityLabel={t.apply.messageLabel}
        />
        {error !== null ? <Text style={styles.errorText}>{error}</Text> : null}
        <Button
          label={t.apply.submit}
          loading={submitting}
          onPress={() => {
            setSubmitting(true);
            setError(null);
            submitApplication(opportunity.opportunityId, message.trim().length > 0 ? message.trim() : null, null)
              .then((result) => {
                setSubmitting(false);
                if (result.failed || result.data === null || result.data.length === 0) {
                  setError(t.common.loadErrorTitle);
                  return;
                }
                onApplied(result.data);
              })
              .catch(() => {
                setSubmitting(false);
                setError(t.common.loadErrorTitle);
              });
          }}
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>{t.apply.titleExternal}</CardTitle>
      <Card tone="warning">
        <CardTitle>{t.apply.externalNoticeTitle}</CardTitle>
        <Text style={styles.cardBody}>{t.apply.externalNoticeBody}</Text>
      </Card>

      {opportunity.externalApplicationUrl !== null || opportunity.externalApplicationEmail !== null ? (
        <SecondaryButton
          label={opportunity.externalApplicationUrl !== null ? t.apply.openExternal : t.apply.openExternalEmail}
          onPress={() => {
            recordOutboundClick(opportunity.opportunityId)
              .then(() => setClickRecorded(true))
              .catch(() => setClickRecorded(true));
          }}
        />
      ) : null}

      {clickRecorded ? (
        <Card tone="info">
          <CardTitle>{t.apply.clickRecordedTitle}</CardTitle>
          <Text style={styles.cardBody}>{t.apply.clickRecordedBody}</Text>
        </Card>
      ) : null}

      {!declareOpen ? (
        <SecondaryButton label={t.apply.declareTitle} onPress={() => setDeclareOpen(true)} />
      ) : (
        <View style={styles.declareForm}>
          <Text style={styles.cardBody}>{t.apply.declareBody}</Text>
          <TextInput
            style={styles.input}
            placeholder={t.apply.declareDateLabel}
            placeholderTextColor={colors.textMuted}
            value={declaredDate}
            onChangeText={setDeclaredDate}
            accessibilityLabel={t.apply.declareDateLabel}
          />
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={2}
            placeholder={t.apply.declareNoteLabel}
            placeholderTextColor={colors.textMuted}
            value={declareNote}
            onChangeText={setDeclareNote}
            accessibilityLabel={t.apply.declareNoteLabel}
          />
          {error !== null ? <Text style={styles.errorText}>{error}</Text> : null}
          <Button
            label={t.apply.declareSubmit}
            loading={declaring}
            onPress={() => {
              if (declaredDate.trim().length === 0) {
                setError(t.apply.declareDateLabel);
                return;
              }
              setDeclaring(true);
              setError(null);
              declareExternalApplication(
                opportunity.opportunityId,
                declaredDate.trim(),
                declareNote.trim().length > 0 ? declareNote.trim() : null,
              )
                .then((result) => {
                  setDeclaring(false);
                  if (result.failed || result.data === null || result.data.length === 0) {
                    setError(t.common.loadErrorTitle);
                    return;
                  }
                  onApplied(result.data);
                })
                .catch(() => {
                  setDeclaring(false);
                  setError(t.common.loadErrorTitle);
                });
            }}
          />
        </View>
      )}
    </Card>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t.common.back} hitSlop={8}>
        <Text style={styles.headerBack}>‹</Text>
      </Pressable>
      <Text style={styles.headerTitle}>{t.detail.title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    gap: space[5],
    paddingBottom: space[8],
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: rounded.base,
    backgroundColor: colors.border,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
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
  meta: {
    ...textStyle.bodySm,
    color: colors.textMuted,
  },
  deadline: {
    ...textStyle.bodySm,
    color: colors.warning,
    fontWeight: '700',
  },
  cardBody: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  reasonLine: {
    ...textStyle.bodySm,
    color: colors.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    gap: space[3],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerPrimary: {
    flex: 1,
  },
  textArea: {
    ...textStyle.bodySm,
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    padding: space[4],
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  input: {
    ...textStyle.bodySm,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  declareForm: {
    gap: space[3],
  },
  errorText: {
    ...textStyle.caption,
    color: colors.error,
  },
});
