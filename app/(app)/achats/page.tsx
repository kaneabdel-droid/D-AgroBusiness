import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'

export default async function AchatsPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: achats } = await supabase
    .from('achats')
    .select('id, numero, date_achat, reference_facture, total_ht, total_tva, total_ttc, tiers:fournisseur_id(nom)')
    .order('date_achat', { ascending: false })
    .order('numero', { ascending: false })
    .limit(100)
  const peutEcrire = ['admin', 'comptable'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre={t('Achats d’intrants')}
        description={t('Chaque achat entre en stock au coût d’achat et génère l’écriture (stock / TVA déductible / fournisseur).')}
      >
        {peutEcrire && (
          <Button asChild>
            <Link href="/achats/nouvelle"><Plus className="h-4 w-4" aria-hidden /> {t('Nouvel achat')}</Link>
          </Button>
        )}
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>N°</th>
            <th className={th}>{t('Date')}</th>
            <th className={th}>{t('Fournisseur')}</th>
            <th className={th}>{t('Facture')}</th>
            <th className={`${th} text-right`}>{t('HT')}</th>
            <th className={`${th} text-right`}>{t('TTC')}</th>
          </tr>
        </thead>
        <tbody>
          {achats?.map((a) => {
            const f = Array.isArray(a.tiers) ? a.tiers[0] : a.tiers
            return (
              <tr key={a.id}>
                <td className={td}>{a.numero}</td>
                <td className={td}>{formatDate(a.date_achat, ctx.lang)}</td>
                <td className={td}>{f?.nom}</td>
                <td className={td}>{a.reference_facture ?? '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(a.total_ht, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(a.total_ttc, ctx.devise, ctx.lang)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
