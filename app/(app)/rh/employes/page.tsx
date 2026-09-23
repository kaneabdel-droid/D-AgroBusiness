import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { SITUATIONS, STATUTS_EMPLOYE } from '@/lib/rh'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addEmploye } from '../actions'

export default async function EmployesPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const o = await chargerOptions()
  const supabase = await createClient()
  const { data: employes } = await supabase
    .from('employes')
    .select('*, departements(nom)')
    .order('matricule')
  const peutEcrire = peutMenu(ctx, '/rh/employes', ['admin', 'rh'])

  const parStatut: Record<string, number> = {}
  for (const e of employes ?? []) if (e.actif) parStatut[e.statut] = (parStatut[e.statut] ?? 0) + 1

  return (
    <>
      <PageHeader
        titre={t('Personnel')}
        description={Object.entries(STATUTS_EMPLOYE).map(([k, v]) => `${t(v)} : ${parStatut[k] ?? 0}`).join(' · ')}
      >
        <SimpleCreateForm
          titre={t('Nouvel employé')}
          disabled={!peutEcrire}
          action={addEmploye}
          champs={[
            { name: 'matricule', label: t('Matricule'), required: true },
            { name: 'nom', label: t('Nom'), required: true },
            { name: 'prenom', label: t('Prénom') },
            { name: 'statut', label: t('Statut'), type: 'select', required: true, options: Object.entries(STATUTS_EMPLOYE).map(([value, label]) => ({ value, label: t(label) })) },
            { name: 'poste', label: t('Poste') },
            { name: 'date_embauche', label: t('Date d’embauche'), type: 'date', required: true, defaultValue: new Date().toISOString().slice(0, 10) },
            { name: 'departement_id', label: t('Département d’affectation'), type: 'select', required: true, options: o.departements.map((d) => ({ value: d.id, label: d.label })) },
            { name: 'secteur_id', label: t('Secteur / projet d’affectation'), type: 'select', options: o.secteurs.map((s) => ({ value: s.id, label: s.label })) },
            { name: 'situation_familiale', label: t('Situation familiale'), type: 'select', required: true, defaultValue: 'celibataire', options: SITUATIONS.map((s) => ({ ...s, label: t(s.label) })) },
            { name: 'nombre_enfants', label: t('Enfants à charge'), type: 'number', defaultValue: '0' },
            { name: 'nombre_conjoints', label: t('Conjoint(s) (TRIMF) — vide : 1 si marié, sinon 0'), type: 'number' },
            { name: 'parts_ir', label: t('Parts fiscales — vide : calcul automatique'), type: 'number', step: '0.5' },
            ...(ctx.pays === 'SN' ? [{
              name: 'regime_ipres', label: t('Régime IPRES'), type: 'select' as const, required: true, defaultValue: 'general',
              options: [{ value: 'general', label: t('Général') }, { value: 'cadre', label: t('Général + complémentaire (cadre)') }],
            }] : []),
            { name: 'deduction_fixe_mensuelle', label: t('Déduction forfaitaire mensuelle de la base d’impôt (Mali : indemnité de solidarité ; Nigeria : allègement de loyer)'), type: 'number', step: '0.01', defaultValue: '0' },
            { name: 'telephone', label: t('Téléphone'), type: 'tel' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Matricule')}</th>
            <th className={th}>{t('Nom')}</th>
            <th className={th}>{t('Statut')}</th>
            <th className={th}>{t('Poste')}</th>
            <th className={th}>{t('Département')}</th>
            <th className={th}>{t('Embauche')}</th>
            <th className={`${th} text-right`}>{t('Parts')}</th>
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
                <td className={td}>{t(STATUTS_EMPLOYE[e.statut])}</td>
                <td className={td}>{e.poste ?? '—'}</td>
                <td className={td}>{dep?.nom ? t(dep.nom) : ''}</td>
                <td className={td}>{formatDate(e.date_embauche, ctx.lang)}</td>
                <td className={`${td} text-right`}>{Number(e.parts_ir)}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
