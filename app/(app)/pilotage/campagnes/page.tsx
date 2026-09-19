import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'

export default async function BilansCampagnePage() {
  await getContexte()
  const supabase = await createClient()
  const { data: campagnes } = await supabase.from('campagnes').select('*').order('date_debut', { ascending: false })
  return (
    <>
      <PageHeader titre="Bilans de campagne" description="Production, distribution, recouvrement (espèces et nature), financements et résultat analytique de chaque campagne." />
      <TableWrap>
        <thead>
          <tr><th className={th}>Code</th><th className={th}>Libellé</th><th className={th}>Début</th><th className={th}>Fin</th><th className={th}>Statut</th></tr>
        </thead>
        <tbody>
          {campagnes?.map((c) => (
            <tr key={c.id}>
              <td className={td}><Link href={`/pilotage/campagnes/${c.id}`} className="font-medium text-primary underline">{c.code}</Link></td>
              <td className={td}>{c.libelle}</td>
              <td className={td}>{formatDate(c.date_debut)}</td>
              <td className={td}>{formatDate(c.date_fin)}</td>
              <td className={td}>{c.statut === 'ouverte' ? 'Ouverte' : 'Clôturée'}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
