import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fr } from '../i18n/fr';
import { newCorrelationId } from '../lib/correlation';
import {
  loadNotificationSummary,
  loadRecentNotifications,
  setNotificationRead,
  type NotificationRow,
} from '../lib/queries/notifications';
import { colors, minTouchTarget, rounded, space, textStyle } from '../theme/tokens';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

/** Au-dela, le chiffre exact n'aide plus et deforme la pastille (meme regle que le web, AdminNav/CmsNav). */
function badgeText(count: number): string {
  return count > 99 ? '99+' : String(count);
}

const MONTHS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

function formatDate(iso: string | null): string | null {
  if (iso === null) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

type ListState =
  | { status: 'loading' }
  | { status: 'error'; correlationId: string }
  | { status: 'empty' }
  | { status: 'ready'; rows: NotificationRow[] };

/**
 * D-194 — icone de notifications (cloche) + pastille de non-lus, partagee
 * par les 4 ecrans principaux mobiles (Accueil, Réseau, Opportunités, Moi).
 *
 * DECISION DE CONCEPTION (mode autonome, non arbitree) : plutot que
 * d'ajouter un en-tete React Navigation partage au niveau du
 * `Tab.Navigator` (`AppTabs.tsx`) — ce qui aurait fait apparaitre ce meme
 * en-tete sur CHAQUE ecran pousse a l'interieur des piles a plat de
 * `ReseauStack`/`OpportunitiesDetailStack` (D-169), en double avec leurs
 * propres `ScreenHeader` (fleche de retour) — ce composant est autonome :
 * il ouvre un `Modal` local avec la liste, sans toucher a la navigation
 * partagee. Ni `AppTabs.tsx` ni `RootNavigator.tsx` ne sont modifies.
 *
 * Perimetre minimal (§ hors-perimetre de la tache) : pas de filtre, pas de
 * pagination au-dela des 20 dernieres, pas de navigation vers l'objet
 * concerne (aucun deep-linking mobile n'existe encore vers les ecrans
 * cibles des `action_path` web) — taper une ligne bascule seulement son
 * etat lu/non lu, ce qui suffit a faire descendre la pastille.
 */
export function NotificationBellButton() {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<ListState>({ status: 'loading' });

  const refreshBadge = useCallback(() => {
    loadNotificationSummary()
      .then((result) => {
        if (!result.failed && result.summary) {
          setUnreadCount(result.summary.unread);
        }
      })
      .catch(() => {
        // §47 — echec silencieux : aucune pastille plutot qu'un ecran casse.
      });
  }, []);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge]);

  const loadList = useCallback(() => {
    setState({ status: 'loading' });
    loadRecentNotifications()
      .then((result) => {
        if (result.failed) {
          setState({ status: 'error', correlationId: newCorrelationId() });
        } else if (result.rows.length === 0) {
          setState({ status: 'empty' });
        } else {
          setState({ status: 'ready', rows: [...result.rows] });
        }
      })
      .catch(() => {
        setState({ status: 'error', correlationId: newCorrelationId() });
      });
  }, []);

  const open = useCallback(() => {
    setVisible(true);
    loadList();
  }, [loadList]);

  const close = useCallback(() => {
    setVisible(false);
    refreshBadge();
  }, [refreshBadge]);

  const toggleRead = useCallback(
    (row: NotificationRow) => {
      const nextRead = !row.read;
      setState((current) => {
        if (current.status !== 'ready') return current;
        return {
          status: 'ready',
          rows: current.rows.map((entry) =>
            entry.notificationId === row.notificationId ? { ...entry, read: nextRead } : entry,
          ),
        };
      });
      setUnreadCount((current) =>
        current === null ? current : Math.max(0, current + (nextRead ? -1 : 1)),
      );
      setNotificationRead(row.notificationId, nextRead).catch(() => {
        // §47 — un echec d'ecriture n'annule pas l'affichage optimiste ici :
        // l'utilisateur reverra le vrai etat au prochain chargement.
      });
    },
    [],
  );

  const hasUnread = typeof unreadCount === 'number' && unreadCount > 0;

  return (
    <>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={
          hasUnread
            ? `${fr.notifications.title} — ${unreadCount} ${fr.notifications.unreadHint}`
            : fr.notifications.title
        }
        hitSlop={8}
        style={styles.button}
      >
        <Text style={styles.icon}>🔔</Text>
        {hasUnread ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{badgeText(unreadCount)}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={visible} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.modal} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{fr.notifications.title}</Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={fr.notifications.close}
              hitSlop={8}
              style={styles.closeButton}
            >
              <Text style={styles.closeLabel}>✕</Text>
            </Pressable>
          </View>

          {state.status === 'loading' ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.actionBlue} />
            </View>
          ) : null}

          {state.status === 'error' ? (
            <ErrorState
              title={fr.notifications.errorTitle}
              correlationId={state.correlationId}
              onRetry={loadList}
            />
          ) : null}

          {state.status === 'empty' ? (
            <EmptyState title={fr.notifications.emptyTitle} description={fr.notifications.emptyBody} />
          ) : null}

          {state.status === 'ready' ? (
            <FlatList
              data={state.rows}
              keyExtractor={(row) => row.notificationId}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => toggleRead(item)}
                  accessibilityRole="button"
                  accessibilityLabel={item.read ? fr.notifications.markUnread : fr.notifications.markRead}
                  style={[styles.row, item.read ? null : styles.rowUnread]}
                >
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {!item.read ? <View style={styles.dot} /> : null}
                  </View>
                  {item.body ? (
                    <Text style={styles.rowBody} numberOfLines={2}>
                      {item.body}
                    </Text>
                  ) : null}
                  {formatDate(item.createdAt) ? (
                    <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
                  ) : null}
                </Pressable>
              )}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 20,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: rounded.full,
    backgroundColor: colors.actionBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeLabel: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[5],
    paddingTop: space[5],
    paddingBottom: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    ...textStyle.h3,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: {
    ...textStyle.h4,
    color: colors.textPrimary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: space[5],
    gap: space[3],
  },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.base,
    padding: space[4],
    gap: space[2],
    backgroundColor: colors.surface,
  },
  rowUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.actionBlue,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  rowTitle: {
    ...textStyle.body,
    fontWeight: '600',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: rounded.full,
    backgroundColor: colors.actionBlue,
  },
  rowBody: {
    ...textStyle.bodySm,
    color: colors.textSecondary,
  },
  rowDate: {
    ...textStyle.caption,
    color: colors.textMuted,
  },
});
