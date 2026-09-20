import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { TYPES_FINANCEMENT } from '@/lib/catalogue'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'

export default async function BilanCampagnePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()

  const { data: c } = await supabase.from('campagnes').select('*').eq('id', id).maybeSingle()
  if (!c) notFound()

  const [prod, ventes, nature, tiers, analytique, financements] = await Promise.all([
    supabase.from('v_production_secteurs').select('*, produits(nom, unite)').eq('campagne_id', id),
    supabase.from('ventes').select('type, total_ttc').eq('campagne_id', id),
    supabase.from('receptions_nature').select('montant').eq('campagne_id', id),
    supabase.from('v_campagne_tiers').select('*').eq('campagne_id', id),
    supabase.from('v_resultat_analytique').select('departement_id, secteur_id, produits, charges, resultat').eq('campagne_id', id),
    supabase.from('v_financements').select('*').eq('campagne_id', id),
  ])
  const fm = (v: number) => formatMontant(v, ctx.devise, ctx.lang)
  const somme = (rows: { [k: string]: unknown }[] | null, k: string) => (rows ?? []).reduce((s, r) => s + Number(r[k] ?? 0), 0)

  const distribue = somme((ventes.data ?? []).filter((v) => v.type === 'distribution'), 'total_ttc')
  const venduMarche = somme((ventes.data ?? []).filter((v) => v.type === 'marche'), 'total_ttc')
  const nat = somme(nature.data, 'montant')
  const clients = tiers.data?.find((t) => t.cle === 'clients')
  const facture = Number(clients?.total_debit ?? 0)
  const recouvre = Number(clients?.total_credit ?? 0)
  const resteARecouvrer = facture - recouvre
  const nomDep = (i: string | null) => o.departements.find((d) => d.id === i)?.label ?? '—'
  const nomSec = (i: string | null) => (i ? (o.secteurs.find((s) => s.id === i)?.label ?? '?') : '—')

  const analyt = (analytique.data ?? []).map((a) => ({ dep: nomDep(a.departement_id), sec: nomSec(a.secteur_id), produits: Number(a.produits), charges: Number(a.charges), resultat: Number(a.resultat) }))
    .sort((a, b) => a.dep.localeCompare(b.dep))
  const totalRes = analyt.reduce((s, a) => s + a.resultat, 0)

  return (
    <>
      <PageHeader titre={`${t('Bilan de campagne')} — ${c.code}`} description={`${c.libelle} · ${t('du')} ${formatDate(c.date_debut, ctx.lang)} ${t('au')} ${formatDate(c.date_fin, ctx.lang)}`}>
        <Link href="/pilotage/campagnes" className="text-sm text-primary underline">{t('← Campagnes')}</Link>
        <ExportButtons titre={`${t('Bilan de campagne')} ${c.code} — ${t('résultat analytique')}`} sousTitre={`${ctx.organisationNom} · ${c.libelle}`} fichier={`bilan-campagne-${c.code}`}
          colonnes={[t('Département'), t('Secteur / projet'), t('Produits'), t('Charges'), t('Résultat')]}
          lignes={analyt.map((a) => [a.dep, a.sec, a.produits, a.charges, a.resultat])} />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-sm text-foreground-muted">{t('Distribué aux producteurs (TTC)')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{fm(distribue)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Recouvré (espèces + nature)')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{fm(recouvre)}</p><p className="text-xs text-foreground-muted">{t('dont nature reçue :')} {fm(nat)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Taux de recouvrement')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{facture > 0 ? `${((recouvre / facture) * 100).toFixed(1)} %` : '—'}</p><p className="text-xs text-foreground-muted">{t('reste à recouvrer :')} {fm(resteARecouvrer)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Résultat analytique')}</p><p className={`mt-1 text-xl font-semibold tabular-nums ${totalRes < 0 ? 'text-danger' : 'text-success'}`}>{fm(totalRes)}</p><p className="text-xs text-foreground-muted">{t('ventes marché :')} {fm(venduMarche)}</p></Card>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Production')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr><th className={th}>{t('Secteur / projet')}</th><th className={th}>{t('Culture')}</th><th className={`${th} text-right`}>{t('Superficie')}</th><th className={`${th} text-right`}>{t('Récolte')}</th><th className={`${th} text-right`}>{t('Rendement / ha')}</th><th className={`${th} text-right`}>{t('Charges')}</th><th className={`${th} text-right`}>{t('Coût unitaire')}</th></tr>
          </thead>
          <tbody>
            {prod.data?.map((p) => {
              const pr = Array.isArray(p.produits) ? p.produits[0] : p.produits
              return (
                <tr key={p.id}>
                  <td className={td}><Link href={`/production/${p.id}`} className="text-primary underline">{p.secteur_nom}</Link></td>
                  <td className={td}>{pr?.nom}</td>
                  <td className={`${td} text-right`}>{p.superficie != null ? `${Number(p.superficie)} ha` : '—'}</td>
                  <td className={`${td} text-right tabular-nums`}>{Number(p.quantite_recoltee).toLocaleString('fr-FR')} {pr?.unite}</td>
                  <td className={`${td} text-right tabular-nums`}>{p.rendement_par_ha != null ? Number(p.rendement_par_ha).toLocaleString('fr-FR') : '—'}</td>
                  <td className={`${td} text-right tabular-nums`}>{fm(Number(p.charges))}</td>
                  <td className={`${td} text-right tabular-nums`}>{p.cout_unitaire != null ? fm(Number(p.cout_unitaire)) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Résultat analytique par département et secteur')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead><tr><th className={th}>{t('Département')}</th><th className={th}>{t('Secteur / projet')}</th><th className={`${th} text-right`}>{t('Produits')}</th><th className={`${th} text-right`}>{t('Charges')}</th><th className={`${th} text-right`}>{t('Résultat')}</th></tr></thead>
          <tbody>
            {analyt.map((a, i) => (
              <tr key={i}>
                <td className={td}>{a.dep}</td><td className={td}>{a.sec}</td>
                <td className={`${td} text-right tabular-nums`}>{fm(a.produits)}</td>
                <td className={`${td} text-right tabular-nums`}>{fm(a.charges)}</td>
                <td className={`${td} text-right tabular-nums ${a.resultat < 0 ? 'text-danger' : ''}`}>{fm(a.resultat)}</td>
              </tr>
            ))}
            <tr className="font-semibold"><td className={td} colSpan={4}>{t('Résultat de la campagne')}</td><td className={`${td} text-right tabular-nums`}>{fm(totalRes)}</td></tr>
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Financements rattachés à la campagne')}</h2>
      <TableWrap>
        <thead><tr><th className={th}>{t('Contrat')}</th><th className={th}>{t('Type')}</th><th className={`${th} text-right`}>{t('Accordé')}</th><th className={`${th} text-right`}>{t('Reçu')}</th><th className={`${th} text-right`}>{t('Consommé')}</th><th className={`${th} text-right`}>{t('Utilisation')}</th><th className={`${th} text-right`}>{t('Encours')}</th></tr></thead>
        <tbody>
          {financements.data?.map((f) => (
            <tr key={f.id}>
              <td className={td}><Link href={`/financements/${f.id}`} className="text-primary underline">{f.code}</Link></td>
              <td className={td}>{t(TYPES_FINANCEMENT[f.type])}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(Number(f.montant_accorde))}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(Number(f.montant_recu))}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(Number(f.montant_consomme))}</td>
              <td className={`${td} text-right`}>{f.taux_utilisation != null ? `${f.taux_utilisation} %` : '—'}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(Number(f.encours))}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
