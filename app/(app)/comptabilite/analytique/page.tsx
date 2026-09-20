import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ExerciceFilter } from '@/components/ExerciceFilter'

export default async function AnalytiquePage({
  searchParams,
}: {
  searchParams: Promise<{ exercice?: string }>
}) {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const { exercice } = await searchParams
  const supabase = await createClient()

  const [{ data: exercices }, { data: departements }, { data: secteurs }, { data: campagnes }] =
    await Promise.all([
      supabase.from('exercices_comptables').select('id, libelle').order('date_debut', { ascending: false }),
      supabase.from('departements').select('id, nom'),
      supabase.from('secteurs_projets').select('id, nom'),
      supabase.from('campagnes').select('id, code'),
    ])
  const exerciceId = exercice ?? exercices?.[0]?.id

  const { data: lignes } = exerciceId
    ? await supabase.from('v_resultat_analytique').select('*').eq('exercice_id', exerciceId)
    : { data: [] }

  const nom = (liste: { id: string; nom?: string; code?: string }[] | null, id: string | null) =>
    id ? t(liste?.find((x) => x.id === id)?.nom ?? liste?.find((x) => x.id === id)?.code ?? '?') : '—'

  const tri = [...(lignes ?? [])].sort((a, b) =>
    nom(departements, a.departement_id).localeCompare(nom(departements, b.departement_id))
  )
  const total = tri.reduce((s, l) => s + Number(l.resultat), 0)

  return (
    <>
      <PageHeader
        titre={t('Résultat analytique')}
        description={t('Produits, charges et résultat par département × secteur/projet × campagne.')}
      >
        <ExerciceFilter libelleAria={t('Exercice')} libelleBouton={t('Afficher')} exercices={exercices ?? []} selectionne={exerciceId} />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Département')}</th>
            <th className={th}>{t('Secteur / projet')}</th>
            <th className={th}>{t('Campagne')}</th>
            <th className={`${th} text-right`}>{t('Produits')}</th>
            <th className={`${th} text-right`}>{t('Charges')}</th>
            <th className={`${th} text-right`}>{t('Résultat')}</th>
          </tr>
        </thead>
        <tbody>
          {tri.map((l, i) => (
            <tr key={i}>
              <td className={td}>{nom(departements, l.departement_id)}</td>
              <td className={td}>{nom(secteurs, l.secteur_id)}</td>
              <td className={td}>{nom(campagnes, l.campagne_id)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.produits, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(l.charges, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums ${Number(l.resultat) < 0 ? 'text-danger' : ''}`}>
                {formatMontant(l.resultat, ctx.devise, ctx.lang)}
              </td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className={td} colSpan={5}>{t('Résultat total')}</td>
            <td className={`${td} text-right tabular-nums`}>{formatMontant(total, ctx.devise, ctx.lang)}</td>
          </tr>
        </tbody>
      </TableWrap>
    </>
  )
}
