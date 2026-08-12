import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../../components/Button';
import { ErrorState } from '../../components/ErrorState';
import { Screen } from '../../components/Screen';
import { frNetworkCalls } from '../../i18n/network-calls';
import { newCorrelationId } from '../../lib/correlation';
import {
  RESPONSE_TYPES,
  loadNetworkCall,
  respondToCall,
  toggleSavedCall,
  transitionCall,
  type NetworkCallDetail,
  type ResponseType,
} from '../../lib/queries/network-calls';
import type { NetworkCallsStackParamList } from '../../navigation/NetworkCallsStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';

type Props = NativeStackScreenProps<NetworkCallsStackParamList, 'AppelDetail'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; call: NetworkCallDetail };

/**
 * ISE-048 — Détail d'un appel (coquille mobile).
 *
 * Porte `get_network_call`, exactement comme
 * `apps/web/src/app/appels/[callId]/page.tsx`. « Comment pouvez-vous
 * aider ? » n'ouvre pas d'écran séparé : la réponse se saisit EN LIGNE
 * sur cette page (`respond_to_network_call`), conformément à la note
 * mobile de la spécification (« bottom sheet possible pour réponse
 * rapide ») — pas d'écran ISE-051 dédié dans ce lot.
 *
 * ECART ASSUME : « Je connais quelqu'un » et « Je peux faire une
 * introduction » ne recherchent pas un profil ISE dans cette première
 * tranche (pas de sélecteur de profil mobile) — seul un nom de personne
 * externe est proposé pour ces deux types. La recommandation d'un membre
 * du réseau reste une extension future, comme les outils/langues du
 * wizard de création.
 */
export function NetworkCallDetailScreen({ route, navigation }: Props) {
  const { callId } = route.params;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [respondingAs, setRespondingAs] = useState<ResponseType | null>(null);
  const [message, setMessage] = useState('');
  const [externalName, setExternalName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    loadNetworkCall(callId)
      .then((result) => {
        if (result.failed || result.data === null) {
          setState({ status: 'error', correlationId: newCorrelationId() });
          return;
        }
        setState({ status: 'ready', call: result.data });
      })
      .catch(() => setState({ status: 'error', correlationId: newCorrelationId() }));
  }, [callId]);

  useEffect(() => {
    load();
  }, [load]);

  const onToggleSaved = useCallback(() => {
    setState((prev) => {
      if (prev.status !== 'ready') return prev;
      const nextSaved = !prev.call.isSaved;
      toggleSavedCall(callId, nextSaved).catch(() => undefined);
      return { ...prev, call: { ...prev.call, isSaved: nextSaved } };
    });
  }, [callId]);

  const onTransition = useCallback(
    (toStatus: 'paused' | 'active' | 'cancelled') => {
      setTransitioning(true);
      transitionCall(callId, toStatus)
        .then((result) => {
          setTransitioning(false);
          if (!result.failed) load();
        })
        .catch(() => setTransitioning(false));
    },
    [callId, load],
  );

  const submitResponse = useCallback(() => {
    if (respondingAs === null) return;
    setSending(true);
    respondToCall({
      callId,
      responseType: respondingAs,
      message: message.trim().length > 0 ? message.trim() : null,
      sharesContact: false,
      recommendedProfileId: null,
      externalPersonName: externalName.trim().length > 0 ? externalName.trim() : null,
      offersIntroduction: respondingAs === 'introduction',
      consentConfirmed: respondingAs !== 'knows_someone',
    })
      .then((result) => {
        setSending(false);
        if (!result.failed) {
          setSent(true);
          setRespondingAs(null);
        }
      })
      .catch(() => setSending(false));
  }, [callId, respondingAs, message, externalName]);

  if (state.status === 'loading') {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.actionBlue} />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <BackBar onBack={navigation.goBack} />
        <ErrorState
          title={frNetworkCalls.detail.notFoundTitle}
          correlationId={state.correlationId}
          onRetry={load}
        />
      </Screen>
    );
  }

  const { call } = state;
  const isOpen = call.status === 'active';
  const canRespond = isOpen && !call.isAuthor && call.myResponse === null;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <BackBar onBack={navigation.goBack} />

        <View style={styles.badgeRow}>
          {call.urgency === 'deadline_soon' ? (
            <View style={[styles.badge, styles.badgeUrgent]}>
              <Text style={styles.badgeUrgentLabel}>Urgent</Text>
            </View>
          ) : null}
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{frNetworkCalls.type[call.callType] ?? call.callType}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{frNetworkCalls.status[call.status] ?? call.status}</Text>
          </View>
        </View>

        <Text style={styles.title}>{call.title}</Text>
        {call.author !== null ? (
          <Text style={styles.author}>
            {call.author.displayName}
            {call.author.promotionLabel ? ` · ${call.author.promotionLabel}` : ''}
          </Text>
        ) : null}
        {call.deadline !== null ? (
          <Text style={styles.deadline}>
            {frNetworkCalls.detail.deadlineLabel} : {call.deadline}
          </Text>
        ) : null}

        {call.relevance !== null ? (
          <View style={styles.relevanceBox}>
            <Text style={styles.relevanceTitle}>{frNetworkCalls.list.whyTitle}</Text>
            {call.relevance.reasons.map((reason, index) => (
              <Text key={index} style={styles.relevanceReason}>
                ✓ {reason.label}
              </Text>
            ))}
          </View>
        ) : null}

        <Section title={frNetworkCalls.detail.needTitle}>
          <Text style={styles.paragraph}>{call.description}</Text>
        </Section>

        {call.context !== null ? (
          <Section title={frNetworkCalls.detail.contextTitle}>
            <Text style={styles.paragraph}>{call.context}</Text>
          </Section>
        ) : null}

        {call.wantedProfile !== null || call.skills.length > 0 || call.sector !== null ? (
          <Section title={frNetworkCalls.detail.wantedProfileTitle}>
            {call.wantedProfile !== null ? <Text style={styles.paragraph}>{call.wantedProfile}</Text> : null}
            {call.skills.length > 0 ? (
              <Text style={styles.metaLine}>
                {frNetworkCalls.detail.skillsLabel} :{' '}
                {call.skills
                  .map((s) => `${s.name}${s.importance === 'required' ? ` (${frNetworkCalls.common.required})` : ''}`)
                  .join(', ')}
              </Text>
            ) : null}
            {call.sector !== null ? (
              <Text style={styles.metaLine}>
                {frNetworkCalls.detail.sectorLabel} : {call.sector}
              </Text>
            ) : null}
            {call.minExperienceYears !== null ? (
              <Text style={styles.metaLine}>
                {frNetworkCalls.detail.experienceLabel} :{' '}
                {frNetworkCalls.detail.experienceMin.replace('{years}', String(call.minExperienceYears))}
              </Text>
            ) : null}
          </Section>
        ) : null}

        {call.helpTypes.length > 0 ? (
          <Section title={frNetworkCalls.detail.helpTypesTitle}>
            <Text style={styles.paragraph}>
              {call.helpTypes.map((h) => frNetworkCalls.helpType[h] ?? h).join(' · ')}
            </Text>
          </Section>
        ) : null}

        <Section title={frNetworkCalls.detail.keyInfoTitle}>
          <Text style={styles.metaLine}>
            {frNetworkCalls.detail.visibilityLabel} : {frNetworkCalls.visibility[call.visibility] ?? call.visibility}
          </Text>
          {call.isAuthor ? (
            <Text style={styles.metaLine}>
              {frNetworkCalls.detail.responsesLabel} : {call.responseCount}
            </Text>
          ) : null}
        </Section>

        <Text style={styles.privacyNote}>{frNetworkCalls.detail.privacyBody}</Text>

        <View style={styles.actions}>
          <Pressable onPress={onToggleSaved} accessibilityRole="button" style={styles.linkButton}>
            <Text style={styles.linkButtonLabel}>
              {call.isSaved ? frNetworkCalls.list.unsave : frNetworkCalls.list.save}
            </Text>
          </Pressable>

          {call.isAuthor ? (
            <View style={styles.manageBox}>
              <Text style={styles.manageTitle}>{frNetworkCalls.detail.manageTitle}</Text>
              {call.status !== 'draft' ? (
                <Button
                  label={frNetworkCalls.detail.manageTracking}
                  onPress={() => navigation.navigate('AppelSuivi', { callId })}
                />
              ) : (
                <Button
                  label={frNetworkCalls.detail.continueDraft}
                  onPress={() => navigation.navigate('AppelCreer', { callId })}
                />
              )}
              {call.status === 'active' ? (
                <Pressable
                  onPress={() => onTransition('paused')}
                  style={styles.linkButton}
                  disabled={transitioning}
                >
                  <Text style={styles.linkButtonLabel}>{frNetworkCalls.detail.managePause}</Text>
                </Pressable>
              ) : null}
              {call.status === 'paused' ? (
                <Pressable
                  onPress={() => onTransition('active')}
                  style={styles.linkButton}
                  disabled={transitioning}
                >
                  <Text style={styles.linkButtonLabel}>{frNetworkCalls.detail.manageResume}</Text>
                </Pressable>
              ) : null}
              {isOpen || call.status === 'paused' || call.status === 'expired' ? (
                <Pressable
                  onPress={() => navigation.navigate('AppelCloture', { callId })}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkButtonLabel}>{frNetworkCalls.detail.manageClose}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : canRespond ? (
            <View style={styles.respondBox}>
              <Text style={styles.manageTitle}>{frNetworkCalls.detail.howToHelp}</Text>
              {sent ? (
                <Text style={styles.paragraph}>{frNetworkCalls.detail.respondDone}</Text>
              ) : respondingAs === null ? (
                RESPONSE_TYPES.filter((type) => type !== 'other').map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setRespondingAs(type)}
                    style={styles.responseTypeButton}
                  >
                    <Text style={styles.responseTypeLabel}>{frNetworkCalls.responseType[type]}</Text>
                  </Pressable>
                ))
              ) : (
                <View style={styles.respondForm}>
                  <Text style={styles.manageTitle}>{frNetworkCalls.responseType[respondingAs]}</Text>
                  {respondingAs === 'knows_someone' || respondingAs === 'introduction' ? (
                    <TextInput
                      value={externalName}
                      onChangeText={setExternalName}
                      placeholder={frNetworkCalls.detail.recommendExternalNameLabel}
                      placeholderTextColor={colors.textMuted}
                      style={styles.textInput}
                    />
                  ) : null}
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder={frNetworkCalls.detail.respondMessagePlaceholder}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={4}
                    style={[styles.textInput, styles.textArea]}
                  />
                  <Button
                    label={sending ? frNetworkCalls.detail.respondSubmitPending : frNetworkCalls.detail.respondSubmit}
                    onPress={submitResponse}
                    loading={sending}
                  />
                  <Pressable onPress={() => setRespondingAs(null)} style={styles.linkButton}>
                    <Text style={styles.linkButtonLabel}>{frNetworkCalls.detail.respondCancel}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : call.myResponse !== null ? (
            <Text style={styles.paragraph}>{frNetworkCalls.detail.alreadyRespondedBody}</Text>
          ) : (
            <Text style={styles.paragraph}>{frNetworkCalls.detail.closedBody}</Text>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <Pressable onPress={onBack} accessibilityRole="button" style={styles.backBar}>
      <Text style={styles.backLabel}>{frNetworkCalls.common.back}</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBar: { marginBottom: space[3] },
  backLabel: { ...textStyle.bodySm, color: colors.actionBlue, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', gap: space[2], marginBottom: space[3] },
  badge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.full,
    paddingHorizontal: space[3],
    paddingVertical: 2,
  },
  badgeLabel: { ...textStyle.caption, color: colors.textSecondary, fontWeight: '700' },
  badgeUrgent: { backgroundColor: '#FEF3C7' },
  badgeUrgentLabel: { ...textStyle.caption, color: '#92400E', fontWeight: '700' },
  title: { ...textStyle.h3, fontWeight: '700', color: colors.textPrimary, marginBottom: space[2] },
  author: { ...textStyle.bodySm, color: colors.textSecondary, marginBottom: space[1] },
  deadline: { ...textStyle.caption, color: colors.textMuted, marginBottom: space[4] },
  relevanceBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: rounded.base,
    padding: space[4],
    gap: 2,
    marginBottom: space[5],
  },
  relevanceTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textSecondary },
  relevanceReason: { ...textStyle.caption, color: colors.textSecondary },
  section: { marginBottom: space[5], gap: space[1] },
  sectionTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  paragraph: { ...textStyle.bodySm, color: colors.textSecondary },
  metaLine: { ...textStyle.caption, color: colors.textSecondary },
  privacyNote: { ...textStyle.caption, color: colors.textMuted, marginBottom: space[5] },
  actions: { gap: space[4], paddingBottom: space[8] },
  linkButton: { paddingVertical: space[2] },
  linkButtonLabel: { ...textStyle.bodySm, color: colors.actionBlue, fontWeight: '700' },
  manageBox: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    gap: space[3],
  },
  manageTitle: { ...textStyle.bodySm, fontWeight: '700', color: colors.textPrimary },
  respondBox: {
    backgroundColor: colors.surface,
    borderRadius: rounded.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    gap: space[3],
  },
  responseTypeButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
  },
  responseTypeLabel: { ...textStyle.bodySm, color: colors.textPrimary, fontWeight: '600' },
  respondForm: { gap: space[3] },
  textInput: {
    ...textStyle.bodySm,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    paddingHorizontal: space[4],
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  textArea: { minHeight: 96, textAlignVertical: 'top', paddingTop: space[3] },
});
