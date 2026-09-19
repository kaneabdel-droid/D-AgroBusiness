import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExerciceFilter } from '@/components/ExerciceFilter'

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ exercice?: string }>
}) {
  const ctx = await getContexte()
  const { exercice } = await searchParams
  const supabase = await createClient()

  const { data: exercices } = await supabase
    .from('exercices_comptables')
    .select('id, libelle')
    .order('date_debut', { ascending: false })
  const exerciceId = exercice ?? exercices?.[0]?.id

  const { data: lignes } = exerciceId
    ? await supabase.from('v_balance').select('*').eq('exercice_id', exerciceId).order('numero')
    : { data: [] }

  const totalDebit = (lignes ?? []).reduce((s, l) => s + Number(l.total_debit), 0)
  const totalCredit = (lignes ?? []).reduce((s, l) => s + Number(l.total_credit), 0)

  return (
    <>
      <PageHeader titre="Balance générale" description="Totaux débit/crédit et solde par compte.">
        <ExerciceFilter exercices={exercices ?? []} selectionne={exerciceId} />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Compte</th>
            <th className={th}>Libellé</th>
            <th className={`${th} text-right`}>Débit</th>
            <th className={`${th} text-right`}>Crédit</th>
            <th className={`${th} text-right`}>Solde</th>
          </tr>
        </thead>
        <tbody>
          {lignes?.map((l) => (
            <tr key={l.compte_id}>
              <td className={td}>{l.numero}</td>
              <td className={td}>{l.libelle}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.total_debit, ctx.devise)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.total_credit, ctx.devise)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.solde, ctx.devise)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={td} colSpan={2}>Totaux</td>
            <td className={`${td} text-right tabular-nums`}>{formatMontant(totalDebit, ctx.devise)}</td>
            <td className={`${td} text-right tabular-nums`}>{formatMontant(totalCredit, ctx.devise)}</td>
            <td className={`${td} text-right tabular-nums`}>{formatMontant(totalDebit - totalCredit, ctx.devise)}</td>
          </tr>
        </tbody>
      </TableWrap>
    </>
  )
}
