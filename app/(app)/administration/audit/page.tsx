import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'

const ACTIONS: Record<string, string> = { INSERT: 'Création', UPDATE: 'Modification', DELETE: 'Suppression' }

/** Champs modifiés (UPDATE) ou libellé de la ligne concernée, sans les colonnes techniques. */
function resume(action: string, avant: Record<string, unknown> | null, apres: Record<string, unknown> | null): string {
  if (action === 'UPDATE' && avant && apres) {
    const champs = Object.keys(apres).filter((k) => JSON.stringify(apres[k]) !== JSON.stringify(avant[k]))
    return champs.map((k) => `${k} : ${String(avant[k] ?? '—')} → ${String(apres[k] ?? '—')}`).join(' ; ')
  }
  const ligne = apres ?? avant ?? {}
  const cle = ['nom', 'libelle', 'code', 'email', 'nom_complet'].find((k) => typeof ligne[k] === 'string')
  return cle ? String(ligne[cle]) : ''
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const { table } = await searchParams
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  if (!['admin', 'direction'].includes(ctx.role)) {
    return <PageHeader titre={t('Journal d’audit')} description={t('Cette page est réservée aux administrateurs.')} />
  }
  const supabase = await createClient()
  let requete = supabase.from('journal_audit').select('*').order('created_at', { ascending: false }).limit(200)
  if (table) requete = requete.eq('table_name', table)
  const [{ data: lignes }, { data: equipe }] = await Promise.all([
    requete,
    ctx.role === 'admin' ? supabase.rpc('liste_equipe') : Promise.resolve({ data: [] }),
  ])
  const noms = new Map(((equipe ?? []) as { id: string; nom_complet: string | null; email: string }[]).map((u) => [u.id, u.nom_complet || u.email]))
  const tables = [...new Set((lignes ?? []).map((l) => l.table_name))].sort()
  const formatHeure = (iso: string) => new Intl.DateTimeFormat(ctx.lang === 'ar' ? 'ar-u-nu-latn' : ctx.lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

  return (
    <>
      <PageHeader titre={t('Journal d’audit')} description={t('Les 200 dernières modifications des référentiels, des utilisateurs et des invitations : qui a fait quoi, et quand.')}>
        <form method="get" className="flex items-center gap-2 text-sm">
          <label htmlFor="table">{t('Table')}</label>
          <select id="table" name="table" defaultValue={table ?? ''} className="h-9 rounded-lg border border-surface-border bg-surface px-2 text-sm">
            <option value="">{t('Toutes')}</option>
            {[...new Set([...tables, ...(table ? [table] : [])])].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <button type="submit" className="h-9 rounded-lg border border-surface-border px-3 hover:bg-sidebar">{t('Filtrer')}</button>
        </form>
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Date')}</th><th className={th}>{t('Utilisateur')}</th><th className={th}>{t('Action')}</th>
            <th className={th}>{t('Table')}</th><th className={th}>{t('Détail')}</th>
          </tr>
        </thead>
        <tbody>
          {lignes?.map((l) => (
            <tr key={l.id}>
              <td className={`${td} whitespace-nowrap`}>{formatHeure(l.created_at)}</td>
              <td className={td}>{l.utilisateur_id ? noms.get(l.utilisateur_id) ?? '—' : t('Système')}</td>
              <td className={td}>{t(ACTIONS[l.action] ?? l.action)}</td>
              <td className={td}>{l.table_name}</td>
              <td className={`${td} max-w-md break-words text-xs`}>{resume(l.action, l.anciennes_valeurs, l.nouvelles_valeurs)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
