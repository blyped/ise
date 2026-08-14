import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { profileManagement as pm } from '../../i18n/profile-management';
import { useAuth } from '../../lib/auth/AuthProvider';
import { getSupabaseClient } from '../../lib/supabase/client';
import {
  loadCountries,
  loadProfileHeader,
  loadProfileVisibility,
  saveProfileHeader,
  type CountryOption,
  type ProfileHeader,
  type VisibilityLevel,
} from '../../lib/queries/profile-management';
import { useProfileId } from '../../navigation/ProfileManagementStack';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, rounded, space, textStyle } from '../../theme/tokens';
import {
  ErrorBanner,
  FormActions,
  Hint,
  LoadingView,
  SearchPickerModal,
  SecondaryButton,
  SelectField,
  VisibilityPicker,
  useModalState,
} from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'HeaderEdit'>;

/**
 * Champs dont la visibilité suit ce même sélecteur unique (portage réduit du
 * multi-champ web, D-73). `photo` s'y ajoute avec la révision de D-117 : la
 * photo de profil peut désormais exister, son niveau de visibilité doit donc
 * être réglable ici comme sur le web.
 */
const VISIBILITY_FIELDS = [
  'photo',
  'headline',
  'bio',
  'current_position',
  'current_organization',
  'city',
  'country',
  'linkedin_url',
  'website_url',
] as const;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'ready'; header: ProfileHeader | null };

/** Bucket PRIVÉ de la photo de profil (0027). Jamais servi au web ouvert. */
const AVATAR_BUCKET = 'avatars';

/**
 * Libellés du bloc photo. Ils vivent ici, et non dans
 * `src/i18n/profile-management.ts`, parce que ce fichier appartient à un
 * autre lot en cours d'écriture : les mêmes formulations qu'à l'écran web
 * sont reprises (MASTER PROMPT §66).
 */
const PHOTO_TEXT = {
  title: 'Photo de profil',
  current: 'Cette photo n’est visible que des membres autorisés.',
  none: 'Vos initiales sont utilisées tant qu’aucune photo n’est déposée.',
  webOnly:
    'Le dépôt d’une nouvelle photo se fait depuis le site web, dans « Modifier l’en-tête & À propos ». L’application mobile ne propose pas encore de sélecteur d’image.',
  removeAction: 'Retirer ma photo',
  removePending: 'Retrait en cours…',
  removeConfirm: 'Votre photo sera effacée. Vos initiales reprendront sa place.',
  removeFailed: 'Le retrait de la photo a échoué. Réessayez dans un instant.',
} as const;

/**
 * ISE-017 — En-tête & À propos.
 *
 * PHOTO DE PROFIL — révision de D-117 (14/08/2026), partiellement portée ici.
 *
 * CE QUI EST FAIT SUR CET ÉCRAN : la photo existante est AFFICHÉE (URL signée
 * du bucket privé `avatars`, comme sur le web) et peut être RETIRÉE. Ces deux
 * gestes ne demandent aucune dépendance supplémentaire.
 *
 * CE QUI N'EST PAS FAIT, ET POURQUOI : le DÉPÔT d'une nouvelle photo suppose
 * un sélecteur d'image natif (galerie ou appareil photo). Le projet Expo ne
 * contient à ce jour ni `expo-image-picker` ni `expo-file-system`
 * (`apps/mobile/package.json`), et ajouter une dépendance native de force
 * — hors validation du porteur et sans build vérifié — serait plus risqué
 * qu'utile. Plutôt qu'un bouton « Changer la photo » qui n'ouvrirait rien
 * (bouton décoratif, MASTER PROMPT §113), l'écran DIT où le dépôt se fait :
 * sur le web. Le jour où la dépendance est ajoutée, seul le bloc ci-dessous
 * change ; la garde reste en base (politique `ise_avatars_write`, contrainte
 * `ise_profiles_avatar_path_scope` de 0126).
 */
export function HeaderEditScreen({ navigation }: Props) {
  const { user } = useAuth();
  const profileId = useProfileId();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [currentPosition, setCurrentPosition] = useState('');
  const [currentOrganizationRaw, setCurrentOrganizationRaw] = useState('');
  const [currentCountryCode, setCurrentCountryCode] = useState<string | null>(null);
  const [currentCountryName, setCurrentCountryName] = useState<string | null>(null);
  const [currentCity, setCurrentCity] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [visibility, setVisibility] = useState<VisibilityLevel>('members');
  const [countries, setCountries] = useState<CountryOption[]>([]);

  const countryModal = useModalState();

  /**
   * Photo de profil : le bucket `avatars` est PRIVÉ (0027), il n'existe donc
   * aucune URL publique. On lit le chemin puis on demande une URL signée de
   * courte durée — même mécanique que `signedAvatarUrl` côté web.
   */
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [removingPhoto, setRemovingPhoto] = useState(false);

  const loadAvatar = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('ise_profiles')
      .select('avatar_path')
      .eq('id', profileId)
      .maybeSingle();

    const row = (data ?? null) as { avatar_path?: unknown } | null;
    const path =
      typeof row?.avatar_path === 'string' && row.avatar_path.length > 0 ? row.avatar_path : null;
    setAvatarPath(path);

    if (path === null) {
      setAvatarUrl(null);
      return;
    }
    const signed = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, 300);
    setAvatarUrl(signed.data?.signedUrl ?? null);
  }, [profileId]);

  async function removePhoto() {
    if (avatarPath === null) return;
    setRemovingPhoto(true);
    setError(null);

    const supabase = getSupabaseClient();
    // Les octets d'abord, la colonne ensuite : une fois `avatar_path` remis à
    // NULL, plus personne ne saurait quel fichier effacer. PostgreSQL n'a
    // aucun accès aux octets de Storage — seule l'API les efface.
    await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
    const { error: updateError } = await supabase
      .from('ise_profiles')
      .update({ avatar_path: null })
      .eq('id', profileId);

    setRemovingPhoto(false);
    if (updateError) {
      setError(PHOTO_TEXT.removeFailed);
      return;
    }
    setAvatarPath(null);
    setAvatarUrl(null);
  }

  function confirmRemovePhoto() {
    Alert.alert(PHOTO_TEXT.removeAction, PHOTO_TEXT.removeConfirm, [
      { text: pm.common.cancel, style: 'cancel' },
      { text: PHOTO_TEXT.removeAction, style: 'destructive', onPress: () => void removePhoto() },
    ]);
  }

  const load = useCallback(() => {
    if (!user) return;
    setState({ status: 'loading' });
    Promise.all([loadProfileHeader(user.id), loadCountries()]).then(([headerResult, countriesResult]) => {
      if (!headerResult.ok) {
        setState({ status: 'error', correlationId: headerResult.correlationId });
        return;
      }
      if (countriesResult.ok) setCountries(countriesResult.data);
      const header = headerResult.data;
      if (header) {
        setFirstName(header.firstName);
        setLastName(header.lastName);
        setHeadline(header.headline ?? '');
        setBio(header.bio ?? '');
        setCurrentPosition(header.currentPosition ?? '');
        setCurrentOrganizationRaw(header.currentOrganizationRaw ?? '');
        setCurrentCountryCode(header.currentCountryCode);
        setCurrentCity(header.currentCity ?? '');
        setLinkedinUrl(header.linkedinUrl ?? '');
        setWebsiteUrl(header.websiteUrl ?? '');
        if (countriesResult.ok) {
          const match = countriesResult.data.find((c) => c.code === header.currentCountryCode);
          setCurrentCountryName(match?.name ?? null);
        }
        loadProfileVisibility(profileId).then((visResult) => {
          if (visResult.ok) {
            const first = VISIBILITY_FIELDS.map((key) => visResult.data[key]).find(
              (level): level is VisibilityLevel => level !== undefined,
            );
            if (first) setVisibility(first);
          }
        });
      }
      setState({ status: 'ready', header });
    });
  }, [user, profileId]);

  useEffect(() => {
    load();
    void loadAvatar();
  }, [load, loadAvatar]);

  async function submit() {
    setSaving(true);
    setError(null);
    const visibilityMap = Object.fromEntries(VISIBILITY_FIELDS.map((key) => [key, visibility]));
    const result = await saveProfileHeader(profileId, {
      firstName,
      lastName,
      headline,
      bio,
      currentPosition,
      currentOrganizationRaw,
      currentCountryCode: currentCountryCode ?? '',
      currentCity,
      linkedinUrl,
      websiteUrl,
      visibility: visibilityMap,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigation.goBack();
  }

  if (state.status === 'loading') return <Screen><LoadingView /></Screen>;
  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorBanner title={pm.header.errorTitle} correlationId={state.correlationId} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{pm.header.heading}</Text>
        <Text style={styles.subtitle}>{pm.header.subtitle}</Text>

        <View style={styles.photoCard}>
          <View style={styles.photoRow}>
            {avatarUrl !== null ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarLabel}>
                  {(firstName[0] ?? '').toUpperCase()}
                  {(lastName[0] ?? '').toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.photoTexts}>
              <Text style={styles.photoTitle}>{PHOTO_TEXT.title}</Text>
              <Text style={styles.photoNotice}>
                {avatarUrl !== null ? PHOTO_TEXT.current : PHOTO_TEXT.none}
              </Text>
            </View>
          </View>

          <Text style={styles.photoNotice}>{PHOTO_TEXT.webOnly}</Text>

          {avatarPath !== null ? (
            <SecondaryButton
              label={removingPhoto ? PHOTO_TEXT.removePending : PHOTO_TEXT.removeAction}
              onPress={confirmRemovePhoto}
              disabled={removingPhoto}
            />
          ) : null}
        </View>

        <TextField label={pm.header.firstNameLabel} value={firstName} onChangeText={setFirstName} />
        <TextField label={pm.header.lastNameLabel} value={lastName} onChangeText={setLastName} />
        <TextField label={pm.header.headlineLabel} value={headline} onChangeText={setHeadline} maxLength={200} />
        <TextField
          label={pm.header.organizationLabel}
          value={currentOrganizationRaw}
          onChangeText={setCurrentOrganizationRaw}
        />
        <TextField label={pm.header.positionLabel} value={currentPosition} onChangeText={setCurrentPosition} />
        <SelectField
          label={pm.header.countryLabel}
          value={currentCountryName}
          placeholder={pm.header.countryLabel}
          onPress={countryModal.open}
        />
        <TextField label={pm.header.cityLabel} value={currentCity} onChangeText={setCurrentCity} />
        <TextField
          label={pm.header.bioLabel}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          maxLength={600}
        />
        <TextField label={pm.header.linkedinLabel} value={linkedinUrl} onChangeText={setLinkedinUrl} autoCapitalize="none" />
        <TextField label={pm.header.websiteLabel} value={websiteUrl} onChangeText={setWebsiteUrl} autoCapitalize="none" />

        <VisibilityPicker value={visibility} onChange={setVisibility} />

        <Hint>{pm.header.hint}</Hint>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <FormActions onCancel={() => navigation.goBack()} onSubmit={submit} submitLabel={pm.common.save} saving={saving} />
      </ScrollView>

      <SearchPickerModal
        visible={countryModal.visible}
        title={pm.header.countryLabel}
        placeholder="Rechercher un pays…"
        query={countryModal.query}
        onQueryChange={countryModal.setQuery}
        onClose={countryModal.close}
        options={countries
          .filter((c) => c.name.toLowerCase().includes(countryModal.query.toLowerCase()))
          .map((c) => ({ key: c.code, label: c.name }))}
        onSelect={(option) => {
          setCurrentCountryCode(option.key);
          setCurrentCountryName(option.label);
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
  photoCard: {
    gap: space[4],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[5],
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  photoTexts: {
    flex: 1,
    gap: space[2],
  },
  photoTitle: {
    ...textStyle.bodySm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: rounded.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    ...textStyle.h4,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  photoNotice: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
  error: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
