import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'

export default async function SoldesTiersPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const [{ data: soldes }, { data: tiers }] = await Promise.all([
    supabase.from('v_soldes_tiers').select('*'),
    supabase.from('tiers').select('id, code, nom, types'),
  ])

  const lignes = (soldes ?? [])
    .map((s) => ({ ...s, tiers: tiers?.find((t) => t.id === s.tiers_id) }))
    .sort((a, b) => (a.tiers?.nom ?? '').localeCompare(b.tiers?.nom ?? ''))

  const creances = lignes.filter((l) => Number(l.solde) > 0).reduce((s, l) => s + Number(l.solde), 0)
  const dettes = lignes.filter((l) => Number(l.solde) < 0).reduce((s, l) => s - Number(l.solde), 0)

  return (
    <>
      <PageHeader
        titre={t('Créances et dettes par tiers')}
        description={`${t('Créances')} : ${formatMontant(creances, ctx.devise, ctx.lang)} — ${t('Dettes')} : ${formatMontant(dettes, ctx.devise, ctx.lang)}`}
      />
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Tiers')}</th>
            <th className={th}>{t('Compte')}</th>
            <th className={`${th} text-right`}>{t('Débit')}</th>
            <th className={`${th} text-right`}>{t('Crédit')}</th>
            <th className={`${th} text-right`}>{t('Solde')}</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i}>
              <td className={td}>{l.tiers?.code} — {l.tiers?.nom}</td>
              <td className={td}>{l.compte_numero}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.total_debit, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.total_credit, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums ${Number(l.solde) > 0 ? '' : 'text-danger'}`}>
                {Number(l.solde) > 0 ? `${formatMontant(l.solde, ctx.devise, ctx.lang)} (${t('créance')})` : `${formatMontant(-Number(l.solde), ctx.devise, ctx.lang)} (${t('dette')})`}
              </td>
              <td className={td}>
                <Link href={`/comptabilite/releve?tiers=${l.tiers_id}`} className="text-primary underline">{t('Relevé')}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
