import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addProduction } from './actions'

const STATUTS: Record<string, string> = { en_cours: 'En cours', recoltee: 'Récoltée', cloturee: 'Clôturée' }

export default async function ProductionPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
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
        titre={t('Production agricole')}
        description={t('Une production = un secteur ou projet × une campagne. Son coût est lu dans la comptabilité analytique.')}
      >
        <SimpleCreateForm
          titre={t('Nouvelle production')}
          disabled={!peutEcrire}
          action={addProduction}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'secteur_id', label: t('Secteur / projet'), type: 'select', required: true, options: o.secteurs.map((s) => ({ value: s.id, label: s.label })) },
            { name: 'campagne_id', label: t('Campagne'), type: 'select', required: true, options: o.campagnes.map((c) => ({ value: c.id, label: c.label })) },
            { name: 'produit_id', label: t('Culture / produit attendu'), type: 'select', required: true, options: o.produits.filter((p) => ['produit_agricole', 'semence'].includes(p.categorie)).map((p) => ({ value: p.id, label: p.label })) },
            { name: 'superficie_ha', label: t('Superficie (ha) — par défaut celle du secteur'), type: 'number', step: '0.01' },
            { name: 'date_semis', label: t('Date de semis'), type: 'date' },
            { name: 'date_recolte_prevue', label: t('Récolte prévue'), type: 'date' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Production')}</th>
            <th className={th}>{t('Secteur')}</th>
            <th className={th}>{t('Campagne')}</th>
            <th className={`${th} text-right`}>{t('Superficie')}</th>
            <th className={`${th} text-right`}>{t('Charges')}</th>
            <th className={`${th} text-right`}>{t('Récolte')}</th>
            <th className={`${th} text-right`}>{t('Rendement / ha')}</th>
            <th className={`${th} text-right`}>{t('Coût unitaire')}</th>
            <th className={th}>{t('Statut')}</th>
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
                  <span className="block text-xs text-foreground-muted">{prod?.nom}{p.date_semis ? ` · semis ${formatDate(p.date_semis, ctx.lang)}` : ''}</span>
                </td>
                <td className={td}>{p.secteur_nom}</td>
                <td className={td}>{camp?.code}</td>
                <td className={`${td} text-right`}>{p.superficie != null ? `${Number(p.superficie)} ha` : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(p.charges, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{Number(p.quantite_recoltee).toLocaleString('fr-FR')} {prod?.unite}</td>
                <td className={`${td} text-right tabular-nums`}>{p.rendement_par_ha != null ? Number(p.rendement_par_ha).toLocaleString('fr-FR') : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{p.cout_unitaire != null ? formatMontant(p.cout_unitaire, ctx.devise, ctx.lang) : '—'}</td>
                <td className={td}>{t(STATUTS[p.statut])}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
