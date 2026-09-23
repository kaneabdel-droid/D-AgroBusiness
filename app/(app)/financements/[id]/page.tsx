import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { MODES_REMBOURSEMENT, TYPES_FINANCEMENT } from '@/lib/catalogue'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ActionButton, PayerEcheance } from '@/components/ActionButton'
import { enregistrerTirage, genererEcheancier, rembourserEcheance } from '../../financement/actions'

export default async function FinancementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()

  const { data: c } = await supabase
    .from('v_financements')
    .select('*, tiers:bailleur_id(nom)')
    .eq('id', id)
    .maybeSingle()
  if (!c) notFound()

  const [{ data: echeances }, { data: tirages }] = await Promise.all([
    supabase.from('echeances_financement').select('*').eq('contrat_id', id).order('numero'),
    supabase.from('tirages_financement').select('*').eq('contrat_id', id).order('date_tirage'),
  ])
  const bailleur = Array.isArray(c.tiers) ? c.tiers[0] : c.tiers
  const peutEcrire = peutMenu(ctx, '/financements', ['admin', 'comptable'])
  const utilisable = c.type === 'credit_campagne' || c.type === 'fonds_commercialisation'
  const aucunePayee = !(echeances ?? []).some((e) => e.statut === 'payee')
  const comptes = o.comptesTresorerie
  const totalCapital = (echeances ?? []).reduce((s, e) => s + Number(e.capital), 0)
  const totalInterets = (echeances ?? []).reduce((s, e) => s + Number(e.interets), 0)

  const cartes: [string, string][] = [
    [t('Accordé'), formatMontant(c.montant_accorde, ctx.devise, ctx.lang)],
    [t('Reçu (tirages)'), formatMontant(c.montant_recu, ctx.devise, ctx.lang)],
    [t('Capital remboursé'), formatMontant(c.capital_rembourse, ctx.devise, ctx.lang)],
    [t('Encours'), formatMontant(c.encours, ctx.devise, ctx.lang)],
    [t('Intérêts payés'), formatMontant(c.interets_payes, ctx.devise, ctx.lang)],
  ]
  if (utilisable) {
    cartes.push([t('Consommé (paiements fournisseurs)'), formatMontant(c.montant_consomme, ctx.devise, ctx.lang)])
    cartes.push([t('Taux d’utilisation'), c.taux_utilisation != null ? `${c.taux_utilisation} %` : '—'])
  }

  return (
    <>
      <PageHeader
        titre={`${c.code} — ${c.libelle}`}
        description={`${t(TYPES_FINANCEMENT[c.type])} · ${bailleur?.nom} · ${Number(c.taux_annuel)} ${t('% par an')} · ${c.duree_mois} ${t('mois')} · ${t(MODES_REMBOURSEMENT.find((m) => m.value === c.mode_remboursement)?.label ?? '')}`}
      >
        <Link href="/financements" className="text-sm text-primary underline">{t('← Tous les financements')}</Link>
        {peutEcrire && c.type !== 'credit_bail' && (
          <SimpleCreateForm
            titre={t('Enregistrer un déblocage')}
            action={enregistrerTirage.bind(null, id)}
            champs={[
              { name: 'date', label: t('Date'), type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
              { name: 'montant', label: t('Montant reçu'), type: 'number', step: '0.01', required: true },
              { name: 'compte_tresorerie_id', label: t('Compte crédité'), type: 'select', required: true, options: comptes.map((x) => ({ value: x.id, label: x.label })) },
              { name: 'reference', label: t('Référence') },
            ]}
          />
        )}
        {peutEcrire && aucunePayee && (
          <ActionButton
            label={t('Régénérer l’échéancier')}
            confirmation={t('Remplacer l’échéancier actuel ?')}
            action={genererEcheancier.bind(null, id)}
          />
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cartes.map(([libelle, valeur]) => (
          <Card key={libelle}>
            <p className="text-sm text-foreground-muted">{libelle}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{valeur}</p>
          </Card>
        ))}
      </div>
      {utilisable && (
        <p className="mb-6 text-sm text-foreground-muted">
          {t('Le montant consommé cumule les paiements de fournisseurs rattachés à ce financement lors du règlement (Trésorerie → Règlement tiers → « Financement utilisé »).')}
        </p>
      )}

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Échéancier')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>N°</th>
              <th className={th}>{t('Échéance')}</th>
              <th className={`${th} text-right`}>{t('Capital')}</th>
              <th className={`${th} text-right`}>{t('Intérêts')}</th>
              <th className={`${th} text-right`}>{t('Total')}</th>
              <th className={th}>{t('Statut')}</th>
            </tr>
          </thead>
          <tbody>
            {echeances?.map((e) => (
              <tr key={e.id}>
                <td className={td}>{e.numero}</td>
                <td className={td}>{formatDate(e.date_echeance, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(e.capital, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(e.interets, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(Number(e.capital) + Number(e.interets), ctx.devise, ctx.lang)}</td>
                <td className={td}>
                  {e.statut === 'payee' ? (
                    <span className="text-success">{t('Payée le {d}', { d: formatDate(e.date_paiement, ctx.lang) })}</span>
                  ) : peutEcrire && Number(c.montant_recu) > 0 ? (
                    <PayerEcheance comptes={comptes} action={rembourserEcheance.bind(null, e.id)} />
                  ) : (
                    t('À payer')
                  )}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className={td} colSpan={2}>{t('Totaux')}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(totalCapital, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(totalInterets, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(totalCapital + totalInterets, ctx.devise, ctx.lang)}</td>
              <td className={td}></td>
            </tr>
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Déblocages')}</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Date')}</th>
            <th className={th}>{t('Référence')}</th>
            <th className={`${th} text-right`}>{t('Montant')}</th>
          </tr>
        </thead>
        <tbody>
          {tirages?.map((t) => (
            <tr key={t.id}>
              <td className={td}>{formatDate(t.date_tirage, ctx.lang)}</td>
              <td className={td}>{t.reference ?? '—'}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(t.montant, ctx.devise, ctx.lang)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
