import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { chargerOptions } from '@/lib/options'
import { STATUTS_EMPLOYE, STATUTS_POINTAGE } from '@/lib/rh'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'
import { PointageForm } from '@/components/PointageForm'

export default async function PointagePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const { date: dateParam } = await searchParams
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : new Date().toISOString().slice(0, 10)
  const o = await chargerOptions()
  const supabase = await createClient()

  const [{ data: employes }, { data: pointages }] = await Promise.all([
    supabase.from('employes').select('id, matricule, nom, prenom, statut').eq('actif', true).order('matricule'),
    supabase.from('pointages').select('employe_id, statut').eq('date_pointage', date),
  ])
  const statutDuJour = new Map((pointages ?? []).map((p) => [p.employe_id, p.statut]))
  const peutEcrire = peutMenu(ctx, '/rh/pointage', ['admin', 'rh', 'chef_departement'])

  return (
    <>
      <PageHeader
        titre={t('Pointage')}
        description={t('Présences du jour. Les saisonniers et journaliers sont payés d’après ces jours ; l’imputation au secteur alimente le coût de production.')}
      >
        <ExportButtons titre={`${t('État de pointage')} — ${formatDate(date, ctx.lang)}`} sousTitre={ctx.organisationNom} fichier={`pointage-${date}`}
          colonnes={[t('Matricule'), t('Nom'), t('Statut'), t('Pointage')]}
          lignes={(employes ?? []).map((e) => {
            const s = statutDuJour.get(e.id)
            return [e.matricule, `${e.nom} ${e.prenom ?? ''}`.trim(), t(STATUTS_EMPLOYE[e.statut]), s ? t(STATUTS_POINTAGE.find((x) => x.value === s)?.label ?? s) : t('Non pointée')]
          })}
        />
      </PageHeader>
      {peutEcrire ? (
        <PointageForm
          key={date}
          date={date}
          employes={(employes ?? []).map((e) => ({
            id: e.id,
            label: `${e.matricule} — ${e.nom} ${e.prenom ?? ''}`,
            statut: t(STATUTS_EMPLOYE[e.statut]),
            statutJour: statutDuJour.get(e.id),
          }))}
          secteurs={o.secteurs}
          campagnes={o.campagnes}
        />
      ) : (
        <p className="text-sm text-foreground-muted">{t('Vous n’avez pas le droit de saisir le pointage.')}</p>
      )}
    </>
  )
}
