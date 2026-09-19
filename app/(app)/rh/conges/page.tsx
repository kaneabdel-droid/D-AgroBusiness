import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { TYPES_CONGE } from '@/lib/rh'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ActionButton } from '@/components/ActionButton'
import { addDemandeConge, traiterConge } from '../actions'

const STATUTS: Record<string, string> = { demande: 'En attente', approuve: 'Approuvé', refuse: 'Refusé' }

export default async function CongesPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const [{ data: demandes }, { data: employes }, { data: soldes }] = await Promise.all([
    supabase.from('demandes_conge').select('*, employes(matricule, nom, prenom)').order('created_at', { ascending: false }).limit(100),
    supabase.from('employes').select('id, matricule, nom, prenom').eq('actif', true).order('matricule'),
    supabase.from('v_soldes_conges').select('employe_id, annee, jours_acquis, jours_pris'),
  ])
  const peutDemander = ['admin', 'rh', 'chef_departement'].includes(ctx.role)
  const peutTraiter = ['admin', 'rh'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre={t('Congés et absences')}
        description={t('L’approbation d’une demande pointe automatiquement les jours ouvrables (hors dimanches) : les congés sans solde ne sont pas payés.')}
      >
        <SimpleCreateForm
          titre={t('Nouvelle demande')}
          disabled={!peutDemander}
          action={addDemandeConge}
          champs={[
            { name: 'employe_id', label: t('Employé'), type: 'select', required: true, options: employes?.map((e) => ({ value: e.id, label: `${e.matricule} — ${e.nom} ${e.prenom ?? ''}` })) },
            { name: 'type', label: t('Type'), type: 'select', required: true, options: TYPES_CONGE.map((c) => ({ ...c, label: t(c.label) })) },
            { name: 'date_debut', label: t('Du'), type: 'date', required: true },
            { name: 'date_fin', label: t('Au'), type: 'date', required: true },
            { name: 'motif', label: t('Motif') },
          ]}
        />
      </PageHeader>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Demandes')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>{t('Employé')}</th>
              <th className={th}>{t('Type')}</th>
              <th className={th}>{t('Période')}</th>
              <th className={`${th} text-right`}>{t('Jours')}</th>
              <th className={th}>{t('Statut')}</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {demandes?.map((d) => {
              const e = Array.isArray(d.employes) ? d.employes[0] : d.employes
              return (
                <tr key={d.id}>
                  <td className={td}>{e?.matricule} — {e?.nom} {e?.prenom}</td>
                  <td className={td}>{t(TYPES_CONGE.find((x) => x.value === d.type)?.label ?? '')}</td>
                  <td className={td}>{formatDate(d.date_debut, ctx.lang)} → {formatDate(d.date_fin, ctx.lang)}</td>
                  <td className={`${td} text-right`}>{Number(d.jours)}</td>
                  <td className={td}>{t(STATUTS[d.statut])}</td>
                  <td className={td}>
                    {peutTraiter && d.statut === 'demande' && (
                      <span className="flex gap-2">
                        <ActionButton label={t('Approuver')} variant="default" action={traiterConge.bind(null, d.id, 'approuve')} />
                        <ActionButton label={t('Refuser')} action={traiterConge.bind(null, d.id, 'refuse')} />
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Soldes de congé annuel')}</h2>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Employé')}</th>
            <th className={`${th} text-right`}>{t('Acquis')}</th>
            <th className={`${th} text-right`}>{t('Pris')}</th>
            <th className={`${th} text-right`}>{t('Solde')}</th>
          </tr>
        </thead>
        <tbody>
          {employes?.map((e) => {
            const s = soldes?.find((x) => x.employe_id === e.id)
            const acquis = Number(s?.jours_acquis ?? 0)
            const pris = Number(s?.jours_pris ?? 0)
            return (
              <tr key={e.id}>
                <td className={td}>{e.matricule} — {e.nom} {e.prenom}</td>
                <td className={`${td} text-right tabular-nums`}>{acquis}</td>
                <td className={`${td} text-right tabular-nums`}>{pris}</td>
                <td className={`${td} text-right tabular-nums`}>{acquis - pris}</td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
