import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ContrepassationButton } from '@/components/ContrepassationButton'

type Ligne = { debit: number; credit: number }

export default async function EcrituresPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: ecritures } = await supabase
    .from('ecritures')
    .select('id, numero, date_ecriture, libelle, reference_piece, contrepassation_de, journaux(code), lignes_ecritures(debit, credit)')
    .order('date_ecriture', { ascending: false })
    .order('numero', { ascending: false })
    .limit(100)

  const contrepassees = new Set(
    (ecritures ?? []).map((e) => e.contrepassation_de).filter((v): v is string => !!v)
  )
  const peutEcrire = ['admin', 'comptable'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre={t('Écritures comptables')}
        description={t('Les écritures validées sont immuables : toute correction passe par une contre-passation.')}
      >
        {peutEcrire && (
          <Button asChild>
            <Link href="/comptabilite/ecritures/nouvelle">
              <Plus className="h-4 w-4" aria-hidden /> {t('Nouvelle écriture')}
            </Link>
          </Button>
        )}
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Date')}</th>
            <th className={th}>{t('Journal')}</th>
            <th className={th}>N°</th>
            <th className={th}>{t('Libellé')}</th>
            <th className={`${th} text-right`}>{t('Montant')}</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {ecritures?.map((e) => {
            const journal = Array.isArray(e.journaux) ? e.journaux[0] : e.journaux
            const montant = (e.lignes_ecritures as Ligne[]).reduce((s, l) => s + Number(l.debit), 0)
            const estContrepassation = !!e.contrepassation_de
            const dejaContrepassee = contrepassees.has(e.id)
            return (
              <tr key={e.id}>
                <td className={td}>{formatDate(e.date_ecriture, ctx.lang)}</td>
                <td className={td}>{journal?.code}</td>
                <td className={td}>{e.numero}</td>
                <td className={td}>
                  {e.libelle}
                  {estContrepassation && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-xs">{t('contre-passation')}</span>}
                  {dejaContrepassee && <span className="ml-2 rounded bg-sidebar px-1.5 py-0.5 text-xs">{t('contre-passée')}</span>}
                </td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(montant, ctx.devise, ctx.lang)}</td>
                <td className={td}>
                  {peutEcrire && !estContrepassation && !dejaContrepassee && <ContrepassationButton id={e.id} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
