import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { consommerIntrants, enregistrerRecolte } from '../actions'

export default async function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContexte()
  const o = await chargerOptions()
  const supabase = await createClient()

  const { data: p } = await supabase
    .from('v_production_secteurs')
    .select('*, campagnes(code, libelle), produits(nom, unite)')
    .eq('id', id)
    .maybeSingle()
  if (!p) notFound()

  const [{ data: consos }, { data: recoltes }] = await Promise.all([
    supabase.from('consommations_production').select('*, produits(nom, unite)').eq('production_id', id).order('date_consommation'),
    supabase.from('recoltes').select('*, produits(nom, unite)').eq('production_id', id).order('date_recolte'),
  ])
  const camp = Array.isArray(p.campagnes) ? p.campagnes[0] : p.campagnes
  const prod = Array.isArray(p.produits) ? p.produits[0] : p.produits
  const peutEcrire = ['admin', 'comptable', 'chef_departement'].includes(ctx.role) && p.statut !== 'cloturee'
  const aujourdhui = new Date().toISOString().slice(0, 10)
  const resteAAbsorber = Number(p.charges) - Number(p.valeur_recoltee)

  const cartes: [string, string][] = [
    ['Charges imputées (analytique)', formatMontant(p.charges, ctx.devise)],
    ['Coût par hectare', p.cout_par_ha != null ? formatMontant(p.cout_par_ha, ctx.devise) : '—'],
    ['Récolte', `${Number(p.quantite_recoltee).toLocaleString('fr-FR')} ${prod?.unite}`],
    ['Rendement par hectare', p.rendement_par_ha != null ? Number(p.rendement_par_ha).toLocaleString('fr-FR') : '—'],
    ['Coût de revient unitaire', p.cout_unitaire != null ? formatMontant(p.cout_unitaire, ctx.devise) : '—'],
    ['Coût restant à absorber', formatMontant(Math.max(0, resteAAbsorber), ctx.devise)],
  ]

  return (
    <>
      <PageHeader
        titre={`${p.code} — ${p.secteur_nom}`}
        description={`${prod?.nom} · campagne ${camp?.code} · ${p.superficie != null ? `${Number(p.superficie)} ha` : 'superficie non renseignée'}`}
      >
        <Link href="/production" className="text-sm text-primary underline">← Productions</Link>
        {peutEcrire && (
          <>
            <SimpleCreateForm
              titre="Consommer un intrant"
              action={consommerIntrants.bind(null, id)}
              champs={[
                { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: aujourdhui },
                { name: 'produit_id', label: 'Intrant', type: 'select', required: true, options: o.produits.filter((x) => x.categorie !== 'service').map((x) => ({ value: x.id, label: x.label })) },
                { name: 'magasin_id', label: 'Magasin', type: 'select', required: true, options: o.magasins.map((x) => ({ value: x.id, label: x.label })) },
                { name: 'quantite', label: 'Quantité', type: 'number', step: '0.001', required: true },
              ]}
            />
            <SimpleCreateForm
              titre="Enregistrer une récolte"
              action={enregistrerRecolte.bind(null, id)}
              champs={[
                { name: 'date', label: 'Date', type: 'date', required: true, defaultValue: aujourdhui },
                { name: 'produit_id', label: 'Produit récolté', type: 'select', required: true, defaultValue: p.produit_id, options: o.produits.filter((x) => ['produit_agricole', 'semence'].includes(x.categorie)).map((x) => ({ value: x.id, label: x.label })) },
                { name: 'magasin_id', label: 'Magasin de réception', type: 'select', required: true, options: o.magasins.map((x) => ({ value: x.id, label: x.label })) },
                { name: 'quantite', label: 'Quantité récoltée', type: 'number', step: '0.001', required: true },
                { name: 'valeur_totale', label: 'Valeur (vide = coût de production restant à absorber)', type: 'number', step: '0.01' },
                { name: 'observation', label: 'Observation' },
              ]}
            />
          </>
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cartes.map(([libelle, valeur]) => (
          <Card key={libelle}>
            <p className="text-sm text-foreground-muted">{libelle}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{valeur}</p>
          </Card>
        ))}
      </div>
      <p className="mb-6 text-sm text-foreground-muted">
        Les charges regroupent tout ce qui est imputé à ce secteur et à cette campagne : intrants consommés,
        dotations du matériel affecté, autres dépenses saisies avec le secteur (Trésorerie → Autre opération).
        Une récolte sans valeur saisie est valorisée à ce coût.
      </p>

      <h2 className="mb-2 font-heading text-lg font-semibold">Intrants consommés</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Date</th><th className={th}>Intrant</th>
              <th className={`${th} text-right`}>Quantité</th><th className={`${th} text-right`}>Valeur (CUMP)</th>
            </tr>
          </thead>
          <tbody>
            {consos?.map((c) => {
              const x = Array.isArray(c.produits) ? c.produits[0] : c.produits
              return (
                <tr key={c.id}>
                  <td className={td}>{formatDate(c.date_consommation)}</td>
                  <td className={td}>{x?.nom}</td>
                  <td className={`${td} text-right tabular-nums`}>{Number(c.quantite).toLocaleString('fr-FR')} {x?.unite}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMontant(c.valeur, ctx.devise)}</td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Récoltes</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>N°</th><th className={th}>Date</th><th className={th}>Produit</th>
            <th className={`${th} text-right`}>Quantité</th><th className={`${th} text-right`}>Valeur</th>
          </tr>
        </thead>
        <tbody>
          {recoltes?.map((r) => {
            const x = Array.isArray(r.produits) ? r.produits[0] : r.produits
            return (
              <tr key={r.id}>
                <td className={td}>{r.numero}</td>
                <td className={td}>{formatDate(r.date_recolte)}</td>
                <td className={td}>{x?.nom}</td>
                <td className={`${td} text-right tabular-nums`}>{Number(r.quantite).toLocaleString('fr-FR')} {x?.unite}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(r.valeur, ctx.devise)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
