import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { SITUATIONS, STATUTS_EMPLOYE, TYPES_CONTRAT } from '@/lib/rh'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addContrat } from '../../actions'

export default async function EmployeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const fm = (v: number | string | null) => formatMontant(v, ctx.devise, ctx.lang)
  const supabase = await createClient()

  const { data: e } = await supabase.from('employes').select('*, departements(nom), secteurs_projets(nom)').eq('id', id).maybeSingle()
  if (!e) notFound()
  const [{ data: contrats }, { data: solde }, { data: categories }] = await Promise.all([
    supabase.from('contrats_travail').select('*, categories_salariales(code, libelle)').eq('employe_id', id).order('date_debut', { ascending: false }),
    supabase.from('v_soldes_conges').select('*').eq('employe_id', id).maybeSingle(),
    supabase.from('categories_salariales').select('id, code, libelle').eq('actif', true).order('ordre'),
  ])
  const dep = Array.isArray(e.departements) ? e.departements[0] : e.departements
  const sec = Array.isArray(e.secteurs_projets) ? e.secteurs_projets[0] : e.secteurs_projets
  const peutEcrire = peutMenu(ctx, '/rh/employes', ['admin', 'rh'])
  const acquis = Number(solde?.jours_acquis ?? 0)
  const pris = Number(solde?.jours_pris ?? 0)

  return (
    <>
      <PageHeader
        titre={`${e.matricule} — ${e.nom} ${e.prenom ?? ''}`}
        description={`${t(STATUTS_EMPLOYE[e.statut])}${e.poste ? ` · ${e.poste}` : ''} · ${dep?.nom ? t(dep.nom) : ''}${sec ? ` / ${sec.nom}` : ''} · ${t('embauché le')} ${formatDate(e.date_embauche, ctx.lang)}`}
      >
        <Link href="/rh/employes" className="text-sm text-primary underline">← {t('Personnel')}</Link>
        {peutEcrire && (
          <SimpleCreateForm
            titre={t('Nouveau contrat')}
            action={addContrat.bind(null, id)}
            champs={[
              { name: 'type', label: t('Type'), type: 'select', required: true, options: TYPES_CONTRAT.map((c) => ({ ...c, label: t(c.label) })) },
              { name: 'date_debut', label: t('Début'), type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
              { name: 'date_fin', label: t('Fin'), type: 'date' },
              { name: 'categorie_id', label: t('Catégorie salariale (donne le salaire de base ; vide : saisir librement)'), type: 'select', options: categories?.map((c) => ({ value: c.id, label: `${c.code} — ${c.libelle}` })) },
              { name: 'salaire_base', label: t('Salaire de base mensuel (ignoré si une catégorie est choisie ; ou forfait prestataire)'), type: 'number', step: '0.01' },
              { name: 'sursalaire', label: t('Sursalaire (libre, complète le salaire catégoriel jusqu’au brut négocié)'), type: 'number', step: '0.01' },
              { name: 'primes_mensuelles', label: t('Primes mensuelles'), type: 'number', step: '0.01' },
              { name: 'taux_journalier', label: t('Taux journalier (saisonniers, journaliers)'), type: 'number', step: '0.01' },
            ]}
          />
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-sm text-foreground-muted">{t('Situation')}</p><p className="mt-1 font-semibold">{t(SITUATIONS.find((s) => s.value === e.situation_familiale)?.label ?? '')}</p><p className="text-xs text-foreground-muted">{t('{n} enfant(s) · {m} conjoint(s)', { n: e.nombre_enfants, m: e.nombre_conjoints })}</p></Card>
        <Card><p className="text-sm text-foreground-muted">{t('Parts fiscales')}</p><p className="mt-1 text-xl font-semibold">{Number(e.parts_ir)}</p></Card>
        {ctx.pays === 'SN' && <Card><p className="text-sm text-foreground-muted">{t('Régime IPRES')}</p><p className="mt-1 font-semibold">{e.regime_ipres === 'cadre' ? t('Général + complémentaire') : t('Général')}</p></Card>}
        <Card><p className="text-sm text-foreground-muted">{t('Congés')} {solde?.annee ?? ''}</p><p className="mt-1 text-xl font-semibold tabular-nums">{t('{n} j restants', { n: Math.max(0, acquis - pris) })}</p><p className="text-xs text-foreground-muted">{t('{a} acquis · {p} pris', { a: acquis, p: pris })}</p></Card>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Contrats')}</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Type')}</th>
            <th className={th}>{t('Début')}</th>
            <th className={th}>{t('Fin')}</th>
            <th className={th}>{t('Catégorie')}</th>
            <th className={`${th} text-right`}>{t('Salaire de base')}</th>
            <th className={`${th} text-right`}>{t('Sursalaire')}</th>
            <th className={`${th} text-right`}>{t('Primes')}</th>
            <th className={`${th} text-right`}>{t('Taux journalier')}</th>
          </tr>
        </thead>
        <tbody>
          {contrats?.map((c) => {
            const cat = Array.isArray(c.categories_salariales) ? c.categories_salariales[0] : c.categories_salariales
            return (
            <tr key={c.id}>
              <td className={td}>{t(TYPES_CONTRAT.find((x) => x.value === c.type)?.label ?? '')}</td>
              <td className={td}>{formatDate(c.date_debut, ctx.lang)}</td>
              <td className={td}>{c.date_fin ? formatDate(c.date_fin, ctx.lang) : t('En cours')}</td>
              <td className={td}>{cat ? `${cat.code} — ${cat.libelle}` : '—'}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(c.salaire_base)}</td>
              <td className={`${td} text-right tabular-nums`}>{Number(c.sursalaire) > 0 ? fm(c.sursalaire) : '—'}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(c.primes_mensuelles)}</td>
              <td className={`${td} text-right tabular-nums`}>{c.taux_journalier != null ? fm(c.taux_journalier) : '—'}</td>
            </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
