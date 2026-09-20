import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'

export default async function BilansCampagnePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: campagnes } = await supabase.from('campagnes').select('*').order('date_debut', { ascending: false })
  return (
    <>
      <PageHeader titre={t('Bilans de campagne')} description={t('Production, distribution, recouvrement (espèces et nature), financements et résultat analytique de chaque campagne.')} />
      <TableWrap>
        <thead>
          <tr><th className={th}>{t('Code')}</th><th className={th}>{t('Libellé')}</th><th className={th}>{t('Début')}</th><th className={th}>{t('Fin')}</th><th className={th}>{t('Statut')}</th></tr>
        </thead>
        <tbody>
          {campagnes?.map((c) => (
            <tr key={c.id}>
              <td className={td}><Link href={`/pilotage/campagnes/${c.id}`} className="font-medium text-primary underline">{c.code}</Link></td>
              <td className={td}>{c.libelle}</td>
              <td className={td}>{formatDate(c.date_debut, ctx.lang)}</td>
              <td className={td}>{formatDate(c.date_fin, ctx.lang)}</td>
              <td className={td}>{c.statut === 'ouverte' ? t('Ouverte') : t('Clôturée')}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
