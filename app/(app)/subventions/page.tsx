import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addSubvention, encaisserSubvention } from '../financement/actions'

export default async function SubventionsPage() {
  const ctx = await getContexte()
  const o = await chargerOptions()
  const supabase = await createClient()
  const [{ data: subventions }, { data: materiels }] = await Promise.all([
    supabase.from('v_subventions').select('*, tiers:bailleur_id(nom)').order('date_octroi', { ascending: false }),
    supabase.from('materiels').select('id, code, designation').order('code'),
  ])
  const peutEcrire = ['admin', 'comptable', 'direction'].includes(ctx.role)
  const peutEncaisser = ['admin', 'comptable'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Subventions d'investissement"
        description="Le matériel reste inscrit à son coût global ; la subvention (compte 14) est reprise au résultat (compte 865) au rythme de l'amortissement du bien financé."
      >
        <SimpleCreateForm
          titre="Nouvelle subvention"
          disabled={!peutEcrire}
          action={addSubvention}
          champs={[
            { name: 'code', label: 'Code', required: true },
            { name: 'libelle', label: 'Libellé', required: true },
            { name: 'bailleur_id', label: 'Bailleur', type: 'select', required: true, options: o.bailleurs.map((b) => ({ value: b.id, label: b.label })) },
            { name: 'montant_accorde', label: 'Montant accordé', type: 'number', step: '0.01', required: true },
            { name: 'date_octroi', label: 'Date d’octroi', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            {
              name: 'materiel_id', label: 'Matériel financé (pour la reprise)', type: 'select',
              options: materiels?.map((m) => ({ value: m.id, label: `${m.code} — ${m.designation}` })),
            },
          ]}
        />
        <SimpleCreateForm
          titre="Encaisser une subvention"
          disabled={!peutEncaisser}
          action={encaisserSubvention}
          champs={[
            { name: 'subvention_id', label: 'Subvention', type: 'select', required: true, options: subventions?.map((s) => ({ value: s.id, label: `${s.code} — ${s.libelle}` })) },
            { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            { name: 'montant', label: 'Montant encaissé', type: 'number', step: '0.01', required: true },
            { name: 'compte_tresorerie_id', label: 'Compte crédité', type: 'select', required: true, options: o.comptesTresorerie.map((c) => ({ value: c.id, label: c.label })) },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Code</th>
            <th className={th}>Libellé</th>
            <th className={th}>Bailleur</th>
            <th className={th}>Octroi</th>
            <th className={`${th} text-right`}>Accordé</th>
            <th className={`${th} text-right`}>Encaissé</th>
            <th className={`${th} text-right`}>Repris au résultat</th>
            <th className={`${th} text-right`}>Solde compte 14</th>
          </tr>
        </thead>
        <tbody>
          {subventions?.map((s) => {
            const b = Array.isArray(s.tiers) ? s.tiers[0] : s.tiers
            return (
              <tr key={s.id}>
                <td className={td}>{s.code}</td>
                <td className={td}>{s.libelle}</td>
                <td className={td}>{b?.nom}</td>
                <td className={td}>{formatDate(s.date_octroi)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(s.montant_accorde, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(s.montant_encaisse, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(s.reprises_cumulees, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(s.solde_compte_14, ctx.devise)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
