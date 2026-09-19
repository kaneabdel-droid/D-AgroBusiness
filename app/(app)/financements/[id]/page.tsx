import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
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
  const peutEcrire = ['admin', 'comptable'].includes(ctx.role)
  const utilisable = c.type === 'credit_campagne' || c.type === 'fonds_commercialisation'
  const aucunePayee = !(echeances ?? []).some((e) => e.statut === 'payee')
  const comptes = o.comptesTresorerie
  const totalCapital = (echeances ?? []).reduce((s, e) => s + Number(e.capital), 0)
  const totalInterets = (echeances ?? []).reduce((s, e) => s + Number(e.interets), 0)

  const cartes: [string, string][] = [
    ['Accordé', formatMontant(c.montant_accorde, ctx.devise)],
    ['Reçu (tirages)', formatMontant(c.montant_recu, ctx.devise)],
    ['Capital remboursé', formatMontant(c.capital_rembourse, ctx.devise)],
    ['Encours', formatMontant(c.encours, ctx.devise)],
    ['Intérêts payés', formatMontant(c.interets_payes, ctx.devise)],
  ]
  if (utilisable) {
    cartes.push(['Consommé (paiements fournisseurs)', formatMontant(c.montant_consomme, ctx.devise)])
    cartes.push(['Taux d’utilisation', c.taux_utilisation != null ? `${c.taux_utilisation} %` : '—'])
  }

  return (
    <>
      <PageHeader
        titre={`${c.code} — ${c.libelle}`}
        description={`${TYPES_FINANCEMENT[c.type]} · ${bailleur?.nom} · ${Number(c.taux_annuel)} % l’an · ${c.duree_mois} mois · ${MODES_REMBOURSEMENT.find((m) => m.value === c.mode_remboursement)?.label}`}
      >
        <Link href="/financements" className="text-sm text-primary underline">← Tous les financements</Link>
        {peutEcrire && c.type !== 'credit_bail' && (
          <SimpleCreateForm
            titre="Enregistrer un déblocage"
            action={enregistrerTirage.bind(null, id)}
            champs={[
              { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
              { name: 'montant', label: 'Montant reçu', type: 'number', step: '0.01', required: true },
              { name: 'compte_tresorerie_id', label: 'Compte crédité', type: 'select', required: true, options: comptes.map((x) => ({ value: x.id, label: x.label })) },
              { name: 'reference', label: 'Référence' },
            ]}
          />
        )}
        {peutEcrire && aucunePayee && (
          <ActionButton
            label="Régénérer l'échéancier"
            confirmation="Remplacer l'échéancier actuel ?"
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
          Le montant consommé cumule les paiements de fournisseurs rattachés à ce financement lors du règlement
          (Trésorerie → Règlement tiers → « Financement utilisé »).
        </p>
      )}

      <h2 className="mb-2 font-heading text-lg font-semibold">Échéancier</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>N°</th>
              <th className={th}>Échéance</th>
              <th className={`${th} text-right`}>Capital</th>
              <th className={`${th} text-right`}>Intérêts</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={th}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {echeances?.map((e) => (
              <tr key={e.id}>
                <td className={td}>{e.numero}</td>
                <td className={td}>{formatDate(e.date_echeance)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(e.capital, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(e.interets, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(Number(e.capital) + Number(e.interets), ctx.devise)}</td>
                <td className={td}>
                  {e.statut === 'payee' ? (
                    <span className="text-success">Payée le {formatDate(e.date_paiement)}</span>
                  ) : peutEcrire && Number(c.montant_recu) > 0 ? (
                    <PayerEcheance comptes={comptes} action={rembourserEcheance.bind(null, e.id)} />
                  ) : (
                    'À payer'
                  )}
                </td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className={td} colSpan={2}>Totaux</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(totalCapital, ctx.devise)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(totalInterets, ctx.devise)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(totalCapital + totalInterets, ctx.devise)}</td>
              <td className={td}></td>
            </tr>
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Déblocages</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Date</th>
            <th className={th}>Référence</th>
            <th className={`${th} text-right`}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {tirages?.map((t) => (
            <tr key={t.id}>
              <td className={td}>{formatDate(t.date_tirage)}</td>
              <td className={td}>{t.reference ?? '—'}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(t.montant, ctx.devise)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
