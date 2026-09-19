import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addProduction } from './actions'

const STATUTS: Record<string, string> = { en_cours: 'En cours', recoltee: 'Récoltée', cloturee: 'Clôturée' }

export default async function ProductionPage() {
  const ctx = await getContexte()
  const o = await chargerOptions()
  const supabase = await createClient()
  const { data: productions } = await supabase
    .from('v_production_secteurs')
    .select('*, campagnes(code), produits(nom, unite)')
    .order('created_at', { ascending: false })
  const peutEcrire = ['admin', 'direction', 'chef_departement'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Production agricole"
        description="Une production = un secteur ou projet × une campagne. Son coût est lu dans la comptabilité analytique."
      >
        <SimpleCreateForm
          titre="Nouvelle production"
          disabled={!peutEcrire}
          action={addProduction}
          champs={[
            { name: 'code', label: 'Code', required: true },
            { name: 'secteur_id', label: 'Secteur / projet', type: 'select', required: true, options: o.secteurs.map((s) => ({ value: s.id, label: s.label })) },
            { name: 'campagne_id', label: 'Campagne', type: 'select', required: true, options: o.campagnes.map((c) => ({ value: c.id, label: c.label })) },
            { name: 'produit_id', label: 'Culture / produit attendu', type: 'select', required: true, options: o.produits.filter((p) => ['produit_agricole', 'semence'].includes(p.categorie)).map((p) => ({ value: p.id, label: p.label })) },
            { name: 'superficie_ha', label: 'Superficie (ha) — par défaut celle du secteur', type: 'number', step: '0.01' },
            { name: 'date_semis', label: 'Date de semis', type: 'date' },
            { name: 'date_recolte_prevue', label: 'Récolte prévue', type: 'date' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Production</th>
            <th className={th}>Secteur</th>
            <th className={th}>Campagne</th>
            <th className={`${th} text-right`}>Superficie</th>
            <th className={`${th} text-right`}>Charges</th>
            <th className={`${th} text-right`}>Récolte</th>
            <th className={`${th} text-right`}>Rendement / ha</th>
            <th className={`${th} text-right`}>Coût unitaire</th>
            <th className={th}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {productions?.map((p) => {
            const camp = Array.isArray(p.campagnes) ? p.campagnes[0] : p.campagnes
            const prod = Array.isArray(p.produits) ? p.produits[0] : p.produits
            return (
              <tr key={p.id}>
                <td className={td}>
                  <Link href={`/production/${p.id}`} className="font-medium text-primary underline">{p.code}</Link>
                  <span className="block text-xs text-foreground-muted">{prod?.nom}{p.date_semis ? ` · semis ${formatDate(p.date_semis)}` : ''}</span>
                </td>
                <td className={td}>{p.secteur_nom}</td>
                <td className={td}>{camp?.code}</td>
                <td className={`${td} text-right`}>{p.superficie != null ? `${Number(p.superficie)} ha` : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(p.charges, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{Number(p.quantite_recoltee).toLocaleString('fr-FR')} {prod?.unite}</td>
                <td className={`${td} text-right tabular-nums`}>{p.rendement_par_ha != null ? Number(p.rendement_par_ha).toLocaleString('fr-FR') : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{p.cout_unitaire != null ? formatMontant(p.cout_unitaire, ctx.devise) : '—'}</td>
                <td className={td}>{STATUTS[p.statut]}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
