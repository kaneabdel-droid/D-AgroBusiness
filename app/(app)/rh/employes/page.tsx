import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { chargerOptions } from '@/lib/options'
import { SITUATIONS, STATUTS_EMPLOYE } from '@/lib/rh'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addEmploye } from '../actions'

export default async function EmployesPage() {
  const ctx = await getContexte()
  const o = await chargerOptions()
  const supabase = await createClient()
  const { data: employes } = await supabase
    .from('employes')
    .select('*, departements(nom)')
    .order('matricule')
  const peutEcrire = ['admin', 'rh'].includes(ctx.role)

  const parStatut: Record<string, number> = {}
  for (const e of employes ?? []) if (e.actif) parStatut[e.statut] = (parStatut[e.statut] ?? 0) + 1

  return (
    <>
      <PageHeader
        titre="Personnel"
        description={Object.entries(STATUTS_EMPLOYE).map(([k, v]) => `${v} : ${parStatut[k] ?? 0}`).join(' · ')}
      >
        <SimpleCreateForm
          titre="Nouvel employé"
          disabled={!peutEcrire}
          action={addEmploye}
          champs={[
            { name: 'matricule', label: 'Matricule', required: true },
            { name: 'nom', label: 'Nom', required: true },
            { name: 'prenom', label: 'Prénom' },
            { name: 'statut', label: 'Statut', type: 'select', required: true, options: Object.entries(STATUTS_EMPLOYE).map(([value, label]) => ({ value, label })) },
            { name: 'poste', label: 'Poste' },
            { name: 'date_embauche', label: 'Date d’embauche', type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            { name: 'departement_id', label: 'Département d’affectation', type: 'select', required: true, options: o.departements.map((d) => ({ value: d.id, label: d.label })) },
            { name: 'secteur_id', label: 'Secteur / projet d’affectation', type: 'select', options: o.secteurs.map((s) => ({ value: s.id, label: s.label })) },
            { name: 'situation_familiale', label: 'Situation familiale', type: 'select', required: true, defaultValue: 'celibataire', options: SITUATIONS },
            { name: 'nombre_enfants', label: 'Enfants à charge', type: 'number', defaultValue: '0' },
            { name: 'nombre_conjoints', label: 'Conjoint(s) (TRIMF) — vide : 1 si marié, sinon 0', type: 'number' },
            { name: 'parts_ir', label: 'Parts fiscales — vide : calcul automatique', type: 'number', step: '0.5' },
            {
              name: 'regime_ipres', label: 'Régime IPRES', type: 'select', required: true, defaultValue: 'general',
              options: [{ value: 'general', label: 'Général' }, { value: 'cadre', label: 'Général + complémentaire (cadre)' }],
            },
            { name: 'telephone', label: 'Téléphone', type: 'tel' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Matricule</th>
            <th className={th}>Nom</th>
            <th className={th}>Statut</th>
            <th className={th}>Poste</th>
            <th className={th}>Département</th>
            <th className={th}>Embauche</th>
            <th className={`${th} text-right`}>Parts</th>
          </tr>
        </thead>
        <tbody>
          {employes?.map((e) => {
            const dep = Array.isArray(e.departements) ? e.departements[0] : e.departements
            return (
              <tr key={e.id} className={e.actif ? '' : 'opacity-50'}>
                <td className={td}>
                  <Link href={`/rh/employes/${e.id}`} className="font-medium text-primary underline">{e.matricule}</Link>
                </td>
                <td className={td}>{e.nom} {e.prenom}</td>
                <td className={td}>{STATUTS_EMPLOYE[e.statut]}</td>
                <td className={td}>{e.poste ?? '—'}</td>
                <td className={td}>{dep?.nom}</td>
                <td className={td}>{formatDate(e.date_embauche)}</td>
                <td className={`${td} text-right`}>{Number(e.parts_ir)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
