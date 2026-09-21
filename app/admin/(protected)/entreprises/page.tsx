import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { NIVEAUX, type Niveau } from '@/lib/abonnement'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'

export default async function AdminEntreprisesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const lang = await langueNavigateur()
  const t = creerT(lang)
  const admin = createAdminClient()

  let requete = admin
    .from('organisations')
    .select('id, nom, pays, niveau, essai_expire_le, abonnement_expire_le, compte_verrouille, demo, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (q) requete = requete.ilike('nom', `%${q.replace(/[%_]/g, '')}%`)
  const [{ data: orgs }, { data: utilisateurs }] = await Promise.all([requete, admin.from('utilisateurs').select('organisation_id')])

  const nbUtilisateurs = new Map<string, number>()
  for (const u of utilisateurs ?? []) nbUtilisateurs.set(u.organisation_id, (nbUtilisateurs.get(u.organisation_id) ?? 0) + 1)
  const maintenant = new Date()

  return (
    <>
      <PageHeader titre={t('Entreprises')} description={t('Toutes les organisations inscrites, leur niveau et leur échéance.')}>
        <form method="get" className="flex gap-2">
          <input name="q" defaultValue={q ?? ''} placeholder={t('Rechercher par nom')} aria-label={t('Rechercher par nom')} className="h-10 rounded-lg border border-surface-border bg-surface px-3 text-sm" />
          <button type="submit" className="h-10 rounded-lg border border-surface-border px-4 text-sm hover:bg-sidebar">{t('Filtrer')}</button>
        </form>
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Entreprise')}</th><th className={th}>{t('Pays')}</th><th className={th}>{t('Niveau')}</th>
            <th className={th}>{t('Statut')}</th><th className={th}>{t('Fin d’accès')}</th><th className={`${th} text-end`}>{t('Utilisateurs')}</th>
            <th className={th}>{t('Inscrite le')}</th>
          </tr>
        </thead>
        <tbody>
          {orgs?.map((o) => {
            const fin = new Date(Math.max(new Date(o.essai_expire_le).getTime(), o.abonnement_expire_le ? new Date(o.abonnement_expire_le).getTime() : 0))
            const paye = o.abonnement_expire_le !== null && new Date(o.abonnement_expire_le) >= new Date(o.essai_expire_le)
            const statut = o.compte_verrouille ? 'Verrouillée' : fin <= maintenant ? 'Expirée' : paye ? 'Abonnée' : 'Essai'
            const couleur = statut === 'Abonnée' ? 'text-success' : statut === 'Essai' ? 'text-primary' : 'text-danger'
            return (
              <tr key={o.id}>
                <td className={td}>
                  <Link href={`/admin/entreprises/${o.id}`} className="font-medium text-primary underline">{o.nom}</Link>
                  {o.demo && <span className="ms-2 rounded bg-sidebar px-1.5 py-0.5 text-xs text-foreground-muted">{t('Démo')}</span>}
                </td>
                <td className={td}>{o.pays}</td>
                <td className={td}>{t(NIVEAUX[o.niveau as Niveau]?.nom ?? o.niveau)}</td>
                <td className={`${td} font-medium ${couleur}`}>{t(statut)}</td>
                <td className={td}>{formatDate(fin.toISOString(), lang)}</td>
                <td className={`${td} text-end tabular-nums`}>{nbUtilisateurs.get(o.id) ?? 0}</td>
                <td className={td}>{formatDate(o.created_at, lang)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
