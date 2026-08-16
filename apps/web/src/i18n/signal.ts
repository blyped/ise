/**
 * Chaines du GUICHET UNIQUE « Signaler » (D-222) et du COURRIER
 * HEBDOMADAIRE des signaux (D-221).
 *
 * Le guichet ne cree RIEN : chaque carte oriente vers un ecran existant.
 * Les phrases reprennent les mots du porteur (les « 8 cas + le second
 * lot ») plutot que les noms techniques des modules : le membre choisit
 * une intention, jamais une fonctionnalite.
 */
export const frSignal = {
  navLabel: 'Signaler',

  title: 'Signaler au réseau',
  subtitle:
    'Une opportunité à partager, un besoin, une annonce ? Choisissez ce qui vous correspond : nous vous amenons au bon endroit, et l’information circule vers les bonnes personnes.',

  circulationNote:
    'Chaque signal publié est diffusé intelligemment : les membres dont le profil correspond le mieux sont prévenus aussitôt sur la plateforme, et tout le réseau retrouve les signaux de la semaine dans le courrier hebdomadaire. Personne n’est submergé, personne ne rate l’essentiel.',

  offerSection: 'J’offre, je propose',
  seekSection: 'Je cherche',
  announceSection: 'J’annonce',

  cards: {
    offerInternship: {
      title: 'J’offre un stage dans ma structure',
      hint: 'Stage académique ou professionnel — publiez l’offre, les profils correspondants seront prévenus.',
    },
    offerJob: {
      title: 'Je recrute, ou je peux faire recruter',
      hint: 'Publiez l’offre d’emploi ou de mission : elle atteint les ISE dont le profil correspond.',
    },
    offerTender: {
      title: 'Je relaie un appel d’offres ou un marché',
      hint: 'Un appel d’offres repéré ou lancé par votre structure — partagez-le au réseau.',
    },
    offerTraining: {
      title: 'Je signale une formation, une bourse ou une certification',
      hint: 'Programme, bourse, appel à candidatures : faites-en profiter le réseau.',
    },
    offerAvailability: {
      title: 'Je suis disponible pour former, intervenir ou encadrer',
      hint: 'Déclarez vos disponibilités (formation, conférence, expertise ponctuelle, accueil de stagiaire…) : le matching en tient compte.',
    },
    offerMentoring: {
      title: 'Je me porte volontaire pour accompagner la relève',
      hint: 'Activez votre profil mentor : les jeunes ISE pourront vous solliciter.',
    },

    seekExpertise: {
      title: 'Je cherche une expertise ponctuelle ou un consultant',
      hint: 'Économétrie, S&E, enquêtes, data, finance publique… Décrivez le besoin, les bons profils sont alertés.',
    },
    seekSpeaker: {
      title: 'Je cherche un intervenant, formateur ou panéliste',
      hint: 'Pour une formation, une conférence, un enseignement ponctuel.',
    },
    seekTeam: {
      title: 'Je monte une équipe ou un consortium',
      hint: 'Vous répondez à une mission et cherchez des compétences complémentaires dans le réseau.',
    },
    seekPartner: {
      title: 'Je cherche un partenaire ou un prestataire ISE',
      hint: 'Avant de chercher ailleurs, vérifiez si la compétence existe dans le réseau.',
    },
    seekReview: {
      title: 'J’ai besoin d’une revue technique',
      hint: 'Questionnaire, plan de sondage, méthodologie, modèle économétrique, dispositif S&E…',
    },
    seekJob: {
      title: 'Je cherche un emploi, ou je suis à l’écoute',
      hint: 'Signalez votre recherche au réseau — et pensez à mettre à jour votre disponibilité sur votre profil.',
    },
    seekInternship: {
      title: 'Je cherche un stage (académique ou professionnel)',
      hint: 'Étudiant ou jeune diplômé : signalez votre recherche, le réseau peut ouvrir des portes.',
    },
    seekMentor: {
      title: 'J’ai besoin d’un mentor',
      hint: 'Un regard d’expérience pour votre carrière — définissez votre besoin, des mentors vous seront recommandés.',
    },
    seekIntroduction: {
      title: 'Je veux être mis en relation avec une institution',
      hint: 'Un ISE en poste peut vous introduire — la demande passe toujours par un intermédiaire, avec un motif.',
    },

    announceEvent: {
      title: 'J’organise un événement et j’invite le réseau',
      hint: 'Conférence, atelier, manifestation : proposez l’événement, l’administration le publie.',
    },
    announceNews: {
      title: 'J’ai une actualité à partager',
      hint: 'Une réussite, une nomination, une publication : proposez l’actualité au réseau.',
    },
  },

  /** Courrier hebdomadaire des signaux (D-221). */
  digestEmail: {
    subject: 'Cette semaine sur Compétences ISE',
    greeting: 'Bonjour {name},',
    greetingFallback: 'Bonjour,',
    intro: 'Voici les signaux publiés cette semaine par le réseau.',
    matchLine:
      '{count} signal(aux) de cette semaine correspond(ent) particulièrement à votre profil — connectez-vous pour les retrouver dans vos notifications.',
    opportunitiesTitle: 'Opportunités',
    callsTitle: 'Le réseau a besoin de vous',
    eventsTitle: 'Événements à venir',
    cta: 'Ouvrir Compétences ISE',
    optOutNote:
      'Vous recevez ce courrier hebdomadaire parce que vous êtes membre du réseau Compétences ISE. Vous pouvez le désactiver dans Paramètres > Notifications.',
  },
} as const;

/** Interpolation simple `{cle}`, meme convention que les autres catalogues. */
export function tsig(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
