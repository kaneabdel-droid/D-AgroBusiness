import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { CATEGORIES_MATERIEL } from '@/lib/catalogue'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'

export default async function MaterielDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()

  const { data: m } = await supabase
    .from('v_materiels')
    .select('*, departements(nom), tiers:fournisseur_id(nom)')
    .eq('id', id)
    .maybeSingle()
  if (!m) notFound()

  const [{ data: plan }, { data: subventions }, { data: dotations }] = await Promise.all([
    supabase.rpc('plan_amortissement', { p_materiel: id }),
    supabase.from('v_subventions').select('*').eq('materiel_id', id),
    supabase.from('dotations_amortissement').select('montant, reprise_subvention, exercices_comptables(libelle)').eq('materiel_id', id),
  ])
  const dep = Array.isArray(m.departements) ? m.departements[0] : m.departements
  const four = Array.isArray(m.tiers) ? m.tiers[0] : m.tiers
  const subventionTotale = (subventions ?? []).reduce((s, x) => s + Number(x.montant_accorde), 0)

  return (
    <>
      <PageHeader
        titre={`${m.code} — ${m.designation}`}
        description={`${t(CATEGORIES_MATERIEL.find((c) => c.value === m.categorie)?.label ?? '')} · ${dep?.nom ? t(dep.nom) : ''} · ${m.mode_acquisition === 'credit_bail' ? t('crédit-bail') : t('achat')} ${t('auprès de')} ${four?.nom}`}
      >
        <Link href="/materiel" className="text-sm text-primary underline">{t('← Parc matériel')}</Link>
        {m.contrat_financement_id && (
          <Link href={`/financements/${m.contrat_financement_id}`} className="text-sm text-primary underline">{t('Voir le contrat de crédit-bail')}</Link>
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-sm text-foreground-muted">{t('Coût global')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatMontant(m.cout_acquisition, ctx.devise, ctx.lang)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Amortissements comptabilisés')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatMontant(m.cumul_amortissement, ctx.devise, ctx.lang)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Valeur nette comptable')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatMontant(m.valeur_nette_comptable, ctx.devise, ctx.lang)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Subvention accordée')}</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatMontant(subventionTotale, ctx.devise, ctx.lang)}</p></Card>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">
        {t('Plan d’amortissement linéaire · mise en service le {d} · {n} mois', { d: formatDate(m.date_mise_service ?? m.date_acquisition, ctx.lang), n: m.duree_amortissement_mois })}
      </h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>{t('Année civile')}</th>
              <th className={`${th} text-right`}>{t('Mois')}</th>
              <th className={`${th} text-right`}>{t('Dotation')}</th>
              <th className={`${th} text-right`}>{t('Cumul')}</th>
              <th className={`${th} text-right`}>{t('VNC')}</th>
            </tr>
          </thead>
          <tbody>
            {plan?.map((l: { annee: number; mois: number; dotation: number; cumul: number; vnc: number }) => (
              <tr key={l.annee}>
                <td className={td}>{l.annee}</td>
                <td className={`${td} text-right`}>{l.mois}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(l.dotation, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(l.cumul, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(l.vnc, ctx.devise, ctx.lang)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Dotations comptabilisées')}</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Exercice')}</th>
            <th className={`${th} text-right`}>{t('Dotation')}</th>
            <th className={`${th} text-right`}>{t('Reprise de subvention')}</th>
          </tr>
        </thead>
        <tbody>
          {dotations?.map((d, i) => {
            const ex = Array.isArray(d.exercices_comptables) ? d.exercices_comptables[0] : d.exercices_comptables
            return (
              <tr key={i}>
                <td className={td}>{ex?.libelle}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(d.montant, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(d.reprise_subvention, ctx.devise, ctx.lang)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
