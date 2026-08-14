import { Alert, Badge, Card, CardHeader, CardTitle } from '@ise/ui-web';
import { frDonations, tdon } from '@/i18n/donations';
import { requireAdminPermission } from '@/lib/admin/permissions';
import {
  loadAdminDonationSummary,
  loadAdminDonations,
  loadDonationCurrencyRules,
} from '@/lib/queries/donations';
import { formatDonationAmount, type DonationStatus } from '@/lib/donations/shared';
import { AdminPageHeader } from '../_components/AdminPageHeader';

/**
 * SUIVI DES DONS — back-office.
 *
 * PERMISSION DEDIEE `donations.read` (0134). La garde ci-dessous evite
 * d'afficher un ecran vide ; la vraie barriere est en base : la politique
 * RLS de `public.donations` et le controle de `admin_donation_summary()`.
 *
 * LES TOTAUX NE COMPTENT QUE LES DONS CONFIRMES par la notification serveur
 * a serveur du prestataire. Un don « en attente » n'est PAS de l'argent
 * recu, et ne doit jamais gonfler un total : c'est la difference entre une
 * intention et une recette.
 *
 * LES DEVISES NE SONT JAMAIS ADDITIONNEES entre elles. Aucun taux de change
 * ne fait autorite dans ce projet ; en inventer un fausserait la
 * comptabilite du porteur. Une ligne par devise, et le texte le dit.
 *
 * LE NOM DU DONATEUR n'apparait que si le lecteur a par ailleurs le droit
 * de voir le profil (RLS de `ise_profiles`) et si le don n'est pas anonyme.
 * L'ecran le dit explicitement plutot que d'afficher une case vide.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: frDonations.admin.title };

const STATUS_LABELS: Readonly<Record<string, string>> = frDonations.status;

function statusTone(status: DonationStatus): 'success' | 'error' | 'warning' | 'neutral' {
  if (status === 'succeeded') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'cancelled') return 'warning';
  return 'neutral';
}

function formatDateTime(iso: string | null): string {
  if (iso === null) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function providerLabel(provider: string): string {
  if (provider === 'stripe') return frDonations.admin.providerStripe;
  if (provider === 'cinetpay') return frDonations.admin.providerCinetpay;
  return provider;
}

const CELL = 'px-4 py-3 text-body-sm text-text-primary align-top';
const HEAD = 'px-4 py-3 text-caption text-text-muted text-left font-medium';

export default async function AdminDonationsPage() {
  await requireAdminPermission('donations.read');

  const [summary, rows, rules] = await Promise.all([
    loadAdminDonationSummary(),
    loadAdminDonations(),
    loadDonationCurrencyRules(),
  ]);

  const exponentOf = (currency: string): number =>
    rules.find((rule) => rule.currency === currency)?.minorUnitExponent ?? 0;

  const statusEntries = summary === null ? [] : Object.entries(summary.byStatus);

  return (
    <div className="flex flex-col gap-7">
      <AdminPageHeader title={frDonations.admin.title} subtitle={frDonations.admin.subtitle} />

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frDonations.admin.summaryTitle}</CardTitle>
        </CardHeader>

        {summary === null || summary.byCurrency.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frDonations.admin.summaryEmpty}</p>
        ) : (
          <ul className="flex flex-wrap gap-6">
            {summary.byCurrency.map((total) => (
              <li key={total.currency} className="flex flex-col gap-1">
                <span className="text-h2 text-text-primary font-bold">
                  {formatDonationAmount(
                    total.totalAmountMinor,
                    total.currency,
                    total.minorUnitExponent,
                  )}
                </span>
                <span className="text-caption text-text-secondary">
                  {tdon(frDonations.admin.countLabel, { count: total.donationCount })}
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-caption text-text-muted mt-4">{frDonations.admin.summaryNote}</p>

        {statusEntries.length > 0 ? (
          <div className="mt-5 flex flex-col gap-2">
            <span className="text-caption text-text-muted">
              {frDonations.admin.statusBreakdown}
            </span>
            <div className="flex flex-wrap gap-2">
              {statusEntries.map(([status, count]) => (
                <Badge key={status} tone="neutral">
                  {`${STATUS_LABELS[status] ?? status} : ${String(count)}`}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card padding="none">
        <div className="px-6 pt-6 pb-4">
          <CardTitle as="h2">{frDonations.admin.listTitle}</CardTitle>
        </div>

        {rows === null ? (
          <div className="px-6 pb-6">
            <Alert variant="error" title={frDonations.admin.loadError}>
              {frDonations.admin.summaryNote}
            </Alert>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-body-sm text-text-secondary px-6 pb-6">
            {frDonations.admin.listEmpty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead className="border-border border-y">
                <tr>
                  <th scope="col" className={HEAD}>
                    {frDonations.admin.columnDate}
                  </th>
                  <th scope="col" className={HEAD}>
                    {frDonations.admin.columnDonor}
                  </th>
                  <th scope="col" className={HEAD}>
                    {frDonations.admin.columnAmount}
                  </th>
                  <th scope="col" className={HEAD}>
                    {frDonations.admin.columnProvider}
                  </th>
                  <th scope="col" className={HEAD}>
                    {frDonations.admin.columnStatus}
                  </th>
                  <th scope="col" className={HEAD}>
                    {frDonations.admin.columnReference}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-border border-b last:border-b-0">
                    <td className={CELL}>{formatDateTime(row.createdAt)}</td>
                    <td className={CELL}>
                      {row.isAnonymous
                        ? frDonations.admin.anonymous
                        : (row.donorName ?? frDonations.admin.donorUnavailable)}
                    </td>
                    <td className={CELL}>
                      {formatDonationAmount(row.amountMinor, row.currency, exponentOf(row.currency))}
                    </td>
                    <td className={CELL}>{providerLabel(row.provider)}</td>
                    <td className={CELL}>
                      <Badge tone={statusTone(row.status)}>
                        {STATUS_LABELS[row.status] ?? frDonations.status.unknown}
                      </Badge>
                    </td>
                    <td className={`${CELL} break-all`}>{row.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
