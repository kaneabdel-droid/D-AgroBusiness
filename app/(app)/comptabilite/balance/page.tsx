import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExerciceFilter } from '@/components/ExerciceFilter'

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ exercice?: string }>
}) {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
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
      <PageHeader titre={t('Balance générale')} description={t('Totaux débit/crédit et solde par compte.')}>
        <ExerciceFilter libelleAria={t('Exercice')} libelleBouton={t('Afficher')} exercices={exercices ?? []} selectionne={exerciceId} />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Compte')}</th>
            <th className={th}>{t('Libellé')}</th>
            <th className={`${th} text-right`}>{t('Débit')}</th>
            <th className={`${th} text-right`}>{t('Crédit')}</th>
            <th className={`${th} text-right`}>{t('Solde')}</th>
          </tr>
        </thead>
        <tbody>
          {lignes?.map((l) => (
            <tr key={l.compte_id}>
              <td className={td}>{l.numero}</td>
              <td className={td}>{l.libelle}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.total_debit, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.total_credit, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.solde, ctx.devise, ctx.lang)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={td} colSpan={2}>{t('Totaux')}</td>
            <td className={`${td} text-right tabular-nums`}>{formatMontant(totalDebit, ctx.devise, ctx.lang)}</td>
            <td className={`${td} text-right tabular-nums`}>{formatMontant(totalCredit, ctx.devise, ctx.lang)}</td>
            <td className={`${td} text-right tabular-nums`}>{formatMontant(totalDebit - totalCredit, ctx.devise, ctx.lang)}</td>
          </tr>
        </tbody>
      </TableWrap>
    </>
  )
}
