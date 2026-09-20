import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ActionButton } from '@/components/ActionButton'
import { ExportButtons } from '@/components/ExportButtons'
import { addBudgetLigne, approuverBudget, supprimerBudgetLigne } from '../../actions'

type Ligne = {
  departement_id: string; secteur_id: string | null; compte_id: string
  numero: string; libelle: string; classe: number; budget: number; realise: number
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()

  const { data: b } = await supabase.from('budgets').select('*, exercices_comptables(libelle)').eq('id', id).maybeSingle()
  if (!b) notFound()

  const [{ data: suivi }, { data: lignesBrutes }, { data: comptes }] = await Promise.all([
    supabase.from('v_suivi_budget').select('*').eq('budget_id', id),
    supabase.from('budget_lignes').select('id, departement_id, secteur_id, compte_id, montant').eq('budget_id', id),
    supabase.from('comptes_comptables').select('id, numero, libelle, classe').in('classe', [6, 7]).eq('actif', true).order('numero'),
  ])
  const ex = Array.isArray(b.exercices_comptables) ? b.exercices_comptables[0] : b.exercices_comptables
  const peutEcrire = ['admin', 'comptable', 'direction'].includes(ctx.role) && b.statut === 'brouillon'
  const lignes = (suivi ?? []).map((l) => ({ ...l, budget: Number(l.budget), realise: Number(l.realise) })) as Ligne[]
  const nomDep = (i: string) => o.departements.find((d) => d.id === i)?.label ?? '?'
  const nomSec = (i: string | null) => (i ? (o.secteurs.find((s) => s.id === i)?.label ?? '?') : t('Tout le département'))
  const idLigne = (l: Ligne) => lignesBrutes?.find((x) => x.departement_id === l.departement_id && x.compte_id === l.compte_id && (x.secteur_id ?? null) === (l.secteur_id ?? null))?.id

  // Consolidation : charges et produits par département, puis total
  const parDep = new Map<string, { charges: number; chargesReal: number; produits: number; produitsReal: number }>()
  for (const l of lignes) {
    const c = parDep.get(l.departement_id) ?? { charges: 0, chargesReal: 0, produits: 0, produitsReal: 0 }
    if (l.classe === 6) { c.charges += l.budget; c.chargesReal += l.realise } else { c.produits += l.budget; c.produitsReal += l.realise }
    parDep.set(l.departement_id, c)
  }
  const total = [...parDep.values()].reduce((s, c) => ({
    charges: s.charges + c.charges, chargesReal: s.chargesReal + c.chargesReal,
    produits: s.produits + c.produits, produitsReal: s.produitsReal + c.produitsReal,
  }), { charges: 0, chargesReal: 0, produits: 0, produitsReal: 0 })

  const lignesExport = lignes.map((l) => [nomDep(l.departement_id), nomSec(l.secteur_id), `${l.numero} ${l.libelle}`, l.budget, l.realise, l.budget - l.realise])

  return (
    <>
      <PageHeader titre={`${b.code} — ${b.libelle}`} description={`${t('Exercice')} ${ex?.libelle} · ${b.statut === 'approuve' ? t('approuvé (lignes figées)') : t('brouillon')}`}>
        <Link href="/pilotage/budgets" className="text-sm text-primary underline">{t('← Budgets')}</Link>
        <ExportButtons titre={`${t('Suivi budgétaire')} — ${b.libelle}`} sousTitre={`${t('Exercice')} ${ex?.libelle}`} fichier={`suivi-budget-${b.code}`}
          colonnes={[t('Département'), t('Secteur'), t('Compte'), t('Budget'), t('Réalisé'), t('Écart')]} lignes={lignesExport} />
        {peutEcrire && (
          <>
            <SimpleCreateForm
              titre={t('Ajouter une ligne')}
              action={addBudgetLigne.bind(null, id)}
              champs={[
                { name: 'departement_id', label: t('Département'), type: 'select', required: true, options: o.departements.map((d) => ({ value: d.id, label: d.label })) },
                { name: 'secteur_id', label: t('Secteur / projet (vide : tout le département)'), type: 'select', options: o.secteurs.map((s) => ({ value: s.id, label: s.label })) },
                { name: 'compte_id', label: t('Compte de charges (6) ou de produits (7)'), type: 'select', required: true, options: comptes?.map((c) => ({ value: c.id, label: `${c.numero} — ${c.libelle}` })) },
                { name: 'montant', label: t('Montant budgété pour l’exercice'), type: 'number', step: '0.01', required: true },
              ]}
            />
            <ActionButton label={t('Approuver le budget')} variant="default" size="default"
              confirmation={t('Approuver ce budget ? Les lignes ne seront plus modifiables.')} action={approuverBudget.bind(null, id)} />
          </>
        )}
      </PageHeader>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Consolidation par département')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>{t('Département')}</th>
              <th className={`${th} text-right`}>{t('Produits budget')}</th><th className={`${th} text-right`}>{t('Produits réalisés')}</th>
              <th className={`${th} text-right`}>{t('Charges budget')}</th><th className={`${th} text-right`}>{t('Charges réalisées')}</th>
              <th className={`${th} text-right`}>{t('Résultat budgété')}</th><th className={`${th} text-right`}>{t('Résultat réalisé')}</th>
            </tr>
          </thead>
          <tbody>
            {[...parDep.entries()].map(([dep, c]) => {
              const depasse = c.charges > 0 && c.chargesReal > c.charges
              return (
                <tr key={dep}>
                  <td className={td}>{nomDep(dep)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMontant(c.produits, ctx.devise, ctx.lang)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMontant(c.produitsReal, ctx.devise, ctx.lang)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMontant(c.charges, ctx.devise, ctx.lang)}</td>
                  <td className={`${td} text-right tabular-nums ${depasse ? 'font-semibold text-danger' : ''}`}>{formatMontant(c.chargesReal, ctx.devise, ctx.lang)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMontant(c.produits - c.charges, ctx.devise, ctx.lang)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatMontant(c.produitsReal - c.chargesReal, ctx.devise, ctx.lang)}</td>
                </tr>
              )
            })}
            <tr className="font-semibold">
              <td className={td}>{t('Total consolidé')}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(total.produits, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(total.produitsReal, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(total.charges, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(total.chargesReal, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(total.produits - total.charges, ctx.devise, ctx.lang)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(total.produitsReal - total.chargesReal, ctx.devise, ctx.lang)}</td>
            </tr>
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Suivi détaillé (réalisé issu de la comptabilité analytique)')}</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Département')}</th><th className={th}>{t('Secteur')}</th><th className={th}>{t('Compte')}</th>
            <th className={`${th} text-right`}>{t('Budget')}</th><th className={`${th} text-right`}>{t('Réalisé')}</th>
            <th className={`${th} text-right`}>{t('Consommé')}</th><th className={`${th} text-right`}>{t('Écart')}</th><th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const taux = pct(l.realise, l.budget)
            const alerte = l.classe === 6 && l.realise > l.budget
            const ligneId = idLigne(l)
            return (
              <tr key={i}>
                <td className={td}>{nomDep(l.departement_id)}</td>
                <td className={td}>{nomSec(l.secteur_id)}</td>
                <td className={td}>{l.numero} — {l.libelle}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(l.budget, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(l.realise, ctx.devise, ctx.lang)}</td>
                <td className={`${td} text-right tabular-nums ${alerte ? 'font-semibold text-danger' : ''}`}>{taux != null ? `${taux} %` : '—'}</td>
                <td className={`${td} text-right tabular-nums ${alerte ? 'text-danger' : ''}`}>{formatMontant(l.budget - l.realise, ctx.devise, ctx.lang)}</td>
                <td className={td}>{peutEcrire && ligneId && <ActionButton label={t('×')} action={supprimerBudgetLigne.bind(null, ligneId)} />}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
      <Card className="mt-4 text-sm text-foreground-muted">
        {t('Charges : un dépassement du budget apparaît en rouge. Produits : le « consommé » mesure le taux de réalisation. Un budget sans secteur compare le réalisé de tout le département ; avec un secteur, seul ce secteur est retenu.')}
      </Card>
    </>
  )
}
