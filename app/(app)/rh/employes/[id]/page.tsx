import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { SITUATIONS, STATUTS_EMPLOYE, TYPES_CONTRAT } from '@/lib/rh'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addContrat } from '../../actions'

export default async function EmployeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getContexte()
  const supabase = await createClient()

  const { data: e } = await supabase.from('employes').select('*, departements(nom), secteurs_projets(nom)').eq('id', id).maybeSingle()
  if (!e) notFound()
  const [{ data: contrats }, { data: solde }] = await Promise.all([
    supabase.from('contrats_travail').select('*').eq('employe_id', id).order('date_debut', { ascending: false }),
    supabase.from('v_soldes_conges').select('*').eq('employe_id', id).maybeSingle(),
  ])
  const dep = Array.isArray(e.departements) ? e.departements[0] : e.departements
  const sec = Array.isArray(e.secteurs_projets) ? e.secteurs_projets[0] : e.secteurs_projets
  const peutEcrire = ['admin', 'rh'].includes(ctx.role)
  const acquis = Number(solde?.jours_acquis ?? 0)
  const pris = Number(solde?.jours_pris ?? 0)

  return (
    <>
      <PageHeader
        titre={`${e.matricule} — ${e.nom} ${e.prenom ?? ''}`}
        description={`${STATUTS_EMPLOYE[e.statut]}${e.poste ? ` · ${e.poste}` : ''} · ${dep?.nom}${sec ? ` / ${sec.nom}` : ''} · embauché le ${formatDate(e.date_embauche)}`}
      >
        <Link href="/rh/employes" className="text-sm text-primary underline">← Personnel</Link>
        {peutEcrire && (
          <SimpleCreateForm
            titre="Nouveau contrat"
            action={addContrat.bind(null, id)}
            champs={[
              { name: 'type', label: 'Type', type: 'select', required: true, options: TYPES_CONTRAT },
              { name: 'date_debut', label: 'Début', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
              { name: 'date_fin', label: 'Fin', type: 'date' },
              { name: 'salaire_base', label: 'Salaire de base mensuel (ou forfait prestataire)', type: 'number', step: '0.01' },
              { name: 'primes_mensuelles', label: 'Primes mensuelles', type: 'number', step: '0.01' },
              { name: 'taux_journalier', label: 'Taux journalier (saisonniers, journaliers)', type: 'number', step: '0.01' },
            ]}
          />
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-sm text-foreground-muted">Situation</p><p className="mt-1 font-semibold">{SITUATIONS.find((s) => s.value === e.situation_familiale)?.label}</p><p className="text-xs text-foreground-muted">{e.nombre_enfants} enfant(s) · {e.nombre_conjoints} conjoint(s)</p></Card>
        <Card><p className="text-sm text-foreground-muted">Parts fiscales</p><p className="mt-1 text-xl font-semibold">{Number(e.parts_ir)}</p></Card>
        <Card><p className="text-sm text-foreground-muted">Régime IPRES</p><p className="mt-1 font-semibold">{e.regime_ipres === 'cadre' ? 'Général + complémentaire' : 'Général'}</p></Card>
        <Card><p className="text-sm text-foreground-muted">Congés {solde?.annee ?? ''}</p><p className="mt-1 text-xl font-semibold tabular-nums">{Math.max(0, acquis - pris)} j restants</p><p className="text-xs text-foreground-muted">{acquis} acquis · {pris} pris</p></Card>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Contrats</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Type</th>
            <th className={th}>Début</th>
            <th className={th}>Fin</th>
            <th className={`${th} text-right`}>Salaire de base</th>
            <th className={`${th} text-right`}>Primes</th>
            <th className={`${th} text-right`}>Taux journalier</th>
          </tr>
        </thead>
        <tbody>
          {contrats?.map((c) => (
            <tr key={c.id}>
              <td className={td}>{TYPES_CONTRAT.find((t) => t.value === c.type)?.label}</td>
              <td className={td}>{formatDate(c.date_debut)}</td>
              <td className={td}>{c.date_fin ? formatDate(c.date_fin) : 'En cours'}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(c.salaire_base, ctx.devise)}</td>
              <td className={`${td} text-right tabular-nums`}>{formatMontant(c.primes_mensuelles, ctx.devise)}</td>
              <td className={`${td} text-right tabular-nums`}>{c.taux_journalier != null ? formatMontant(c.taux_journalier, ctx.devise) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
