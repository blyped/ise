import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { profileManagement as pm } from '../../i18n/profile-management';
import { useAuth } from '../../lib/auth/AuthProvider';
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
  SelectField,
  VisibilityPicker,
  useModalState,
} from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'HeaderEdit'>;

/** Champs dont la visibilité suit ce même sélecteur unique (portage réduit du multi-champ web, D-73). */
const VISIBILITY_FIELDS = [
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

/**
 * ISE-017 — En-tête & À propos.
 *
 * D-117 : le dépôt de photo n'est PAS ouvert — l'écran l'annonce (bandeau
 * d'attente) plutôt que d'afficher un bouton actif « Changer la photo »
 * comme sur la maquette. Toutes les autres informations restent modifiables.
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
  }, [load]);

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
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>
              {(firstName[0] ?? '').toUpperCase()}
              {(lastName[0] ?? '').toUpperCase()}
            </Text>
          </View>
          <Text style={styles.photoNotice}>Le dépôt de photo n’est pas encore ouvert.</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: space[5],
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
    flex: 1,
  },
  error: {
    ...textStyle.bodySm,
    color: colors.error,
  },
});
