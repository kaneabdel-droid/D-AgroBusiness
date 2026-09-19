import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { MOIS } from '@/lib/rh'
import { formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'

const RUBRIQUES: Record<string, string> = {
  distribution: 'Distribution aux producteurs',
  vente_marche: 'Ventes marché',
  achat: 'Achats',
  remboursement_nature: 'Remboursements en nature',
  recolte: 'Récoltes',
  transformation: 'Ordres de fabrication',
  paie: 'Paie (coût employeur)',
}

export default async function RapportMensuelPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; mois?: string }>
}) {
  const ctx = await getContexte()
  const p = await searchParams
  const now = new Date()
  const annee = Number(p.annee) || now.getFullYear()
  const mois = Math.min(12, Math.max(1, Number(p.mois) || now.getMonth() + 1))
  const precedent = mois === 1 ? { annee: annee - 1, mois: 12 } : { annee, mois: mois - 1 }
  const supabase = await createClient()
  const debutMois = `${annee}-${String(mois).padStart(2, '0')}-01`

  const [{ data: mouvements }, { data: activite }, { data: exercice }] = await Promise.all([
    supabase.from('v_mouvements_tresorerie').select('*'),
    supabase.from('v_activite_mensuelle').select('*').or(`and(annee.eq.${annee},mois.eq.${mois}),and(annee.eq.${precedent.annee},mois.eq.${precedent.mois})`),
    supabase.from('exercices_comptables').select('id, libelle').lte('date_debut', debutMois).gte('date_fin', debutMois).maybeSingle(),
  ])
  const { data: evolution } = exercice
    ? await supabase.from('v_evolution_mensuelle').select('mois, produits, charges').eq('exercice_id', exercice.id).eq('mois', mois)
    : { data: [] }

  const fm = (v: number) => formatMontant(v, ctx.devise)
  const comptes = [...new Map((mouvements ?? []).map((m) => [m.compte_tresorerie_id, m.nom])).entries()]
  const tresorerie = comptes.map(([id, nom]) => {
    const lignes = (mouvements ?? []).filter((m) => m.compte_tresorerie_id === id)
    const avant = lignes.filter((m) => m.annee < annee || (m.annee === annee && m.mois < mois))
    const dans = lignes.filter((m) => m.annee === annee && m.mois === mois)
    const ouverture = avant.reduce((s, m) => s + Number(m.encaissements) - Number(m.decaissements), 0)
    const enc = dans.reduce((s, m) => s + Number(m.encaissements), 0)
    const dec = dans.reduce((s, m) => s + Number(m.decaissements), 0)
    return { nom, ouverture, enc, dec, cloture: ouverture + enc - dec }
  })
  const totalT = tresorerie.reduce((s, t) => ({ ouverture: s.ouverture + t.ouverture, enc: s.enc + t.enc, dec: s.dec + t.dec, cloture: s.cloture + t.cloture }), { ouverture: 0, enc: 0, dec: 0, cloture: 0 })

  const act = Object.keys(RUBRIQUES).map((r) => {
    const cur = activite?.find((a) => a.rubrique === r && a.annee === annee && a.mois === mois)
    const prev = activite?.find((a) => a.rubrique === r && a.annee === precedent.annee && a.mois === precedent.mois)
    const m = Number(cur?.montant ?? 0), mp = Number(prev?.montant ?? 0)
    return { rubrique: RUBRIQUES[r], nb: Number(cur?.nb ?? 0), montant: m, variation: mp > 0 ? `${(((m - mp) / mp) * 100).toFixed(0)} %` : '—' }
  })
  const produits = Number(evolution?.[0]?.produits ?? 0)
  const charges = Number(evolution?.[0]?.charges ?? 0)
  const titre = `${MOIS[mois - 1]} ${annee}`

  return (
    <>
      <PageHeader titre={`Rapport mensuel — ${titre}`} description="Trésorerie, activité et résultat du mois.">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <select name="mois" defaultValue={mois} aria-label="Mois" className="h-10 rounded-lg border border-surface-border bg-surface px-3 text-sm">
            {MOIS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input name="annee" type="number" defaultValue={annee} min={2000} max={2100} aria-label="Année" className="h-10 w-24 rounded-lg border border-surface-border bg-surface px-3 text-sm" />
          <button type="submit" className="h-10 rounded-lg border border-surface-border bg-surface px-3 text-sm">Afficher</button>
        </form>
        <ExportButtons titre={`Rapport mensuel de trésorerie — ${titre}`} sousTitre={ctx.organisationNom} fichier={`rapport-tresorerie-${annee}-${mois}`}
          colonnes={['Compte', 'Ouverture', 'Encaissements', 'Décaissements', 'Clôture']}
          lignes={[...tresorerie.map((t) => [t.nom, t.ouverture, t.enc, t.dec, t.cloture]), ['Total', totalT.ouverture, totalT.enc, totalT.dec, totalT.cloture]]} />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-sm text-foreground-muted">Trésorerie en fin de mois</p><p className="mt-1 text-xl font-semibold tabular-nums">{fm(totalT.cloture)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">Flux net du mois</p><p className={`mt-1 text-xl font-semibold tabular-nums ${totalT.enc - totalT.dec < 0 ? 'text-danger' : 'text-success'}`}>{fm(totalT.enc - totalT.dec)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">Produits du mois</p><p className="mt-1 text-xl font-semibold tabular-nums">{fm(produits)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">Résultat du mois</p><p className={`mt-1 text-xl font-semibold tabular-nums ${produits - charges < 0 ? 'text-danger' : 'text-success'}`}>{fm(produits - charges)}</p><p className="text-xs text-foreground-muted">charges : {fm(charges)}</p></Card>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Trésorerie</h2>
      <div className="mb-6">
        <TableWrap>
          <thead><tr><th className={th}>Compte</th><th className={`${th} text-right`}>Ouverture</th><th className={`${th} text-right`}>Encaissements</th><th className={`${th} text-right`}>Décaissements</th><th className={`${th} text-right`}>Clôture</th></tr></thead>
          <tbody>
            {tresorerie.map((t) => (
              <tr key={t.nom}>
                <td className={td}>{t.nom}</td>
                <td className={`${td} text-right tabular-nums`}>{fm(t.ouverture)}</td>
                <td className={`${td} text-right tabular-nums text-success`}>{fm(t.enc)}</td>
                <td className={`${td} text-right tabular-nums text-danger`}>{fm(t.dec)}</td>
                <td className={`${td} text-right tabular-nums font-medium`}>{fm(t.cloture)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className={td}>Total</td>
              <td className={`${td} text-right tabular-nums`}>{fm(totalT.ouverture)}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(totalT.enc)}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(totalT.dec)}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(totalT.cloture)}</td>
            </tr>
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Rapport d&apos;activité</h2>
      <TableWrap>
        <thead><tr><th className={th}>Rubrique</th><th className={`${th} text-right`}>Opérations</th><th className={`${th} text-right`}>Montant</th><th className={`${th} text-right`}>Variation vs mois précédent</th></tr></thead>
        <tbody>
          {act.map((a) => (
            <tr key={a.rubrique}>
              <td className={td}>{a.rubrique}</td>
              <td className={`${td} text-right`}>{a.nb}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(a.montant)}</td>
              <td className={`${td} text-right`}>{a.variation}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
