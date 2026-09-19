import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'

type LigneReleve = {
  debit: number
  credit: number
  libelle: string | null
  comptes_comptables: { numero: string } | { numero: string }[] | null
  ecritures: { date_ecriture: string; numero: number; libelle: string; journaux: { code: string } | { code: string }[] | null } | { date_ecriture: string; numero: number; libelle: string; journaux: { code: string } | { code: string }[] | null }[] | null
}

const un = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

export default async function RelevePage({
  searchParams,
}: {
  searchParams: Promise<{ tiers?: string; du?: string; au?: string }>
}) {
  const ctx = await getContexte()
  const { tiers: tiersId, du, au } = await searchParams
  const supabase = await createClient()

  const [{ data: tiersListe }, { data: exercice }] = await Promise.all([
    supabase.from('tiers').select('id, code, nom, types').order('nom'),
    supabase.from('exercices_comptables').select('date_debut, date_fin').eq('statut', 'ouvert').order('date_debut', { ascending: false }).limit(1).maybeSingle(),
  ])
  const debut = du ?? exercice?.date_debut ?? `${new Date().getFullYear()}-01-01`
  const fin = au ?? exercice?.date_fin ?? `${new Date().getFullYear()}-12-31`
  const tiers = tiersListe?.find((t) => t.id === tiersId)

  let lignes: LigneReleve[] = []
  let reportAnterieur = 0
  if (tiersId) {
    const base = () =>
      supabase
        .from('lignes_ecritures')
        .select('debit, credit, libelle, comptes_comptables!inner(numero, lettrable), ecritures!inner(date_ecriture, numero, libelle, journaux(code))')
        .eq('tiers_id', tiersId)
        .eq('comptes_comptables.lettrable', true)

    const [{ data: periode }, { data: avant }] = await Promise.all([
      base().gte('ecritures.date_ecriture', debut).lte('ecritures.date_ecriture', fin),
      base().lt('ecritures.date_ecriture', debut),
    ])
    lignes = ((periode ?? []) as unknown as LigneReleve[]).sort((a, b) => {
      const ea = un(a.ecritures)!, eb = un(b.ecritures)!
      return ea.date_ecriture.localeCompare(eb.date_ecriture) || ea.numero - eb.numero
    })
    reportAnterieur = ((avant ?? []) as unknown as LigneReleve[]).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
  }

  const avecSolde = lignes.reduce<{ l: LigneReleve; solde: number }[]>((acc, l) => {
    const precedent = acc.length ? acc[acc.length - 1].solde : reportAnterieur
    acc.push({ l, solde: precedent + Number(l.debit) - Number(l.credit) })
    return acc
  }, [])
  const soldeFinal = avecSolde.length ? avecSolde[avecSolde.length - 1].solde : reportAnterieur
  const totalDebit = lignes.reduce((s, l) => s + Number(l.debit), 0)
  const totalCredit = lignes.reduce((s, l) => s + Number(l.credit), 0)

  return (
    <>
      <PageHeader
        titre="Relevé de compte"
        description="Mouvements d'un tiers (client, producteur ou fournisseur) sur la période choisie, avec solde progressif."
      />
      <Card className="mb-6">
        <form method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="tiers">Tiers</Label>
            <Select id="tiers" name="tiers" defaultValue={tiersId ?? ''} required>
              <option value="">Choisir…</option>
              {tiersListe?.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.nom}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="du">Du</Label>
            <Input id="du" name="du" type="date" defaultValue={debut} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="au">Au</Label>
            <Input id="au" name="au" type="date" defaultValue={fin} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Afficher le relevé</Button></div>
        </form>
      </Card>

      {tiers && (
        <>
          <h2 className="mb-2 font-heading text-lg font-semibold">
            {tiers.code} — {tiers.nom} · du {formatDate(debut)} au {formatDate(fin)}
          </h2>
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Pièce</th>
                <th className={th}>Libellé</th>
                <th className={`${th} text-right`}>Débit</th>
                <th className={`${th} text-right`}>Crédit</th>
                <th className={`${th} text-right`}>Solde</th>
              </tr>
            </thead>
            <tbody>
              <tr className="italic">
                <td className={td} colSpan={5}>Report à nouveau (avant le {formatDate(debut)})</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(reportAnterieur, ctx.devise)}</td>
              </tr>
              {avecSolde.map(({ l, solde }, i) => {
                const e = un(l.ecritures)!
                return (
                  <tr key={i}>
                    <td className={td}>{formatDate(e.date_ecriture)}</td>
                    <td className={td}>{un(e.journaux)?.code}-{e.numero}</td>
                    <td className={td}>{l.libelle ?? e.libelle}</td>
                    <td className={`${td} text-right tabular-nums`}>{Number(l.debit) ? formatMontant(l.debit, ctx.devise) : ''}</td>
                    <td className={`${td} text-right tabular-nums`}>{Number(l.credit) ? formatMontant(l.credit, ctx.devise) : ''}</td>
                    <td className={`${td} text-right tabular-nums`}>{formatMontant(solde, ctx.devise)}</td>
                  </tr>
                )
              })}
              <tr className="font-semibold">
                <td className={td} colSpan={3}>Totaux de la période</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(totalDebit, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(totalCredit, ctx.devise)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(soldeFinal, ctx.devise)}</td>
              </tr>
            </tbody>
          </TableWrap>
          <p className="mt-2 text-sm text-foreground-muted">
            Solde positif : le tiers vous doit ce montant. Solde négatif : vous lui devez ce montant.
          </p>
        </>
      )}
    </>
  )
}
