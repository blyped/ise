import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Screen } from '../../components/Screen';
import { profileManagement as pm } from '../../i18n/profile-management';
import type { ProfileManagementStackParamList } from '../../navigation/ProfileManagementStack';
import { colors, space, textStyle } from '../../theme/tokens';
import { SectionRow } from './_shared';

type Props = NativeStackScreenProps<ProfileManagementStackParamList, 'ManagementHome'>;

/**
 * Menu « Modifier mon profil » — point d'entrée unique vers ISE-017 -> ISE-033.
 *
 * N'est PAS un écran numéroté de la traceability matrix (voir le
 * commentaire de tête de `ProfileManagementStack.tsx`) : il existe pour
 * que chaque section soit joignable depuis un seul endroit, à la manière
 * du menu latéral de `apps/web/src/app/mon-profil/page.tsx`.
 */
export function ManagementHomeScreen({ navigation }: Props) {
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{pm.hub.subtitle}</Text>

        <SectionRow
          title={pm.hub.sections.header.title}
          hint={pm.hub.sections.header.hint}
          onPress={() => navigation.navigate('HeaderEdit')}
        />
        <SectionRow
          title={pm.hub.sections.experiences.title}
          hint={pm.hub.sections.experiences.hint}
          onPress={() => navigation.navigate('Experiences')}
        />
        <SectionRow
          title={pm.hub.sections.educations.title}
          hint={pm.hub.sections.educations.hint}
          onPress={() => navigation.navigate('Educations')}
        />
        <SectionRow
          title={pm.hub.sections.skills.title}
          hint={pm.hub.sections.skills.hint}
          onPress={() => navigation.navigate('Skills')}
        />
        <SectionRow
          title={pm.hub.sections.positioning.title}
          hint={pm.hub.sections.positioning.hint}
          onPress={() => navigation.navigate('Positioning')}
        />
        <SectionRow
          title={pm.hub.sections.projects.title}
          hint={pm.hub.sections.projects.hint}
          onPress={() => navigation.navigate('Projects')}
        />
        <SectionRow
          title={pm.hub.sections.languagesZones.title}
          hint={pm.hub.sections.languagesZones.hint}
          onPress={() => navigation.navigate('LanguagesZones')}
        />
        <SectionRow
          title={pm.hub.sections.recommendations.title}
          hint={pm.hub.sections.recommendations.hint}
          onPress={() => navigation.navigate('Recommendations')}
        />
        <SectionRow
          title={pm.hub.sections.completion.title}
          hint={pm.hub.sections.completion.hint}
          onPress={() => navigation.navigate('Completion')}
        />
        <SectionRow
          title={pm.hub.sections.availability.title}
          hint={pm.hub.sections.availability.hint}
          onPress={() => navigation.navigate('Availability')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: space[4],
    paddingBottom: space[8],
  },
  subtitle: {
    ...textStyle.body,
    color: colors.textSecondary,
    marginBottom: space[2],
  },
});
