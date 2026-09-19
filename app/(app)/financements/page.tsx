import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { MODES_REMBOURSEMENT, TYPES_FINANCEMENT } from '@/lib/catalogue'
import { formatDate, formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addContratFinancement } from '../financement/actions'

export default async function FinancementsPage() {
  const ctx = await getContexte()
  const o = await chargerOptions()
  const supabase = await createClient()
  const { data: contrats } = await supabase
    .from('v_financements')
    .select('*, tiers:bailleur_id(nom)')
    .order('date_debut', { ascending: false })
  const peutEcrire = ['admin', 'comptable', 'direction'].includes(ctx.role)

  const encours = (contrats ?? []).reduce((s, c) => s + Number(c.encours), 0)
  const prochaines = (contrats ?? []).filter((c) => c.prochaine_echeance).length

  return (
    <>
      <PageHeader
        titre="Emprunts et financements"
        description={`Encours total : ${formatMontant(encours, ctx.devise)} — ${prochaines} contrat(s) avec échéance à venir.`}
      >
        <SimpleCreateForm
          titre="Nouveau contrat"
          disabled={!peutEcrire}
          action={addContratFinancement}
          champs={[
            { name: 'code', label: 'Code', required: true },
            { name: 'libelle', label: 'Libellé', required: true },
            {
              name: 'type', label: 'Type', type: 'select', required: true,
              options: Object.entries(TYPES_FINANCEMENT)
                .filter(([v]) => v !== 'credit_bail')
                .map(([value, label]) => ({ value, label })),
            },
            { name: 'bailleur_id', label: 'Banque / bailleur', type: 'select', required: true, options: o.bailleurs.map((b) => ({ value: b.id, label: b.label })) },
            { name: 'montant_accorde', label: 'Montant accordé', type: 'number', step: '0.01', required: true },
            { name: 'taux_annuel', label: 'Taux annuel (%)', type: 'number', step: '0.001', defaultValue: '0' },
            { name: 'duree_mois', label: 'Durée (mois)', type: 'number', required: true },
            {
              name: 'periodicite_mois', label: 'Périodicité des échéances', type: 'select', required: true, defaultValue: '1',
              options: [
                { value: '1', label: 'Mensuelle' }, { value: '3', label: 'Trimestrielle' },
                { value: '6', label: 'Semestrielle' }, { value: '12', label: 'Annuelle' },
              ],
            },
            { name: 'mode_remboursement', label: 'Mode de remboursement', type: 'select', required: true, defaultValue: 'annuite_constante', options: MODES_REMBOURSEMENT },
            { name: 'date_debut', label: 'Date de début', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            { name: 'departement_id', label: 'Département (imputation des intérêts)', type: 'select', required: true, options: o.departements.map((d) => ({ value: d.id, label: d.label })) },
            { name: 'campagne_id', label: 'Campagne (crédit de campagne / fonds)', type: 'select', options: o.campagnes.map((c) => ({ value: c.id, label: c.label })) },
            { name: 'garantie', label: 'Garanties' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Contrat</th>
            <th className={th}>Type</th>
            <th className={th}>Bailleur</th>
            <th className={`${th} text-right`}>Accordé</th>
            <th className={`${th} text-right`}>Reçu</th>
            <th className={`${th} text-right`}>Encours</th>
            <th className={`${th} text-right`}>Utilisation</th>
            <th className={th}>Prochaine échéance</th>
          </tr>
        </thead>
        <tbody>
          {contrats?.map((c) => {
            const b = Array.isArray(c.tiers) ? c.tiers[0] : c.tiers
            const utilisable = c.type === 'credit_campagne' || c.type === 'fonds_commercialisation'
            return (
              <tr key={c.id}>
                <td className={td}>
                  <Link href={`/financements/${c.id}`} className="font-medium text-primary underline">{c.code}</Link>
                  {c.statut === 'solde' && <span className="ml-2 rounded bg-sidebar px-1.5 py-0.5 text-xs">soldé</span>}
                </td>
                <td className={td}>{TYPES_FINANCEMENT[c.type]}</td>
                <td className={td}>{b?.nom}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(c.montant_accorde, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(c.montant_recu, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(c.encours, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{utilisable && c.taux_utilisation != null ? `${c.taux_utilisation} %` : '—'}</td>
                <td className={td}>{c.prochaine_echeance ? formatDate(c.prochaine_echeance) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
