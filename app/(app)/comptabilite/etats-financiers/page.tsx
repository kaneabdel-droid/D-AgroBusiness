import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { PageHeader } from '@/components/ui/card'
import { ExerciceFilter } from '@/components/ExerciceFilter'
import { genererEtatsFinanciersSyscohada, type ExerciceComptable, type LigneBalance } from '@/lib/syscohada'
import EtatsFinanciersClient from './EtatsFinanciersClient'

export default async function EtatsFinanciersSyscohadaPage({
  searchParams,
}: {
  searchParams: Promise<{ exercice?: string }>
}) {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const { exercice } = await searchParams
  const supabase = await createClient()

  const { data: exercicesRaw } = await supabase
    .from('exercices_comptables')
    .select('id, libelle, date_debut, date_fin')
    .order('date_debut', { ascending: false })

  const exercices = (exercicesRaw ?? []) as ExerciceComptable[]
  const courant = exercices.find((e) => e.id === exercice) ?? exercices[0]

  if (!courant) {
    return (
      <div className="p-8 text-center text-foreground-muted">
        {t('Aucun exercice comptable enregistré.')}
      </div>
    )
  }

  // Charger toutes les lignes de la balance générale
  const { data: balanceData } = await supabase
    .from('v_balance')
    .select('exercice_id, numero, libelle, classe, total_debit, total_credit, solde')
    .order('numero')

  const toutesLignes: LigneBalance[] = (balanceData ?? []).map((l) => ({
    exercice_id: l.exercice_id,
    numero: l.numero,
    libelle: l.libelle,
    classe: Number(l.classe) || 1,
    total_debit: Number(l.total_debit) || 0,
    total_credit: Number(l.total_credit) || 0,
    solde: Number(l.solde) || 0,
  }))

  // Charger les informations officielles de l'organisation pour la liasse
  const { data: orgFiche } = await supabase
    .from('organisations')
    .select('nom, adresse, telephone, nif, pays, devise')
    .eq('id', ctx.organisationId)
    .maybeSingle()

  const nomOrg = orgFiche?.nom || ctx.organisationNom || 'ENTREPRISE AGROBUSINESS'
  const sigleCalcule = nomOrg
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 8)
    .toUpperCase()

  const infosEntreprise = {
    denomination: nomOrg,
    sigle: sigleCalcule || 'AGRO',
    adresse: orgFiche?.adresse || 'Dakar, Sénégal',
    telephone: orgFiche?.telephone || '+221 33 800 00 00',
    nineaNif: orgFiche?.nif || 'SN-00123456-2K',
  }

  const etats = genererEtatsFinanciersSyscohada(toutesLignes, courant, exercices, infosEntreprise)

  return (
    <>
      <PageHeader
        titre={t('États financiers SYSCOHADA (Système Normal)')}
        description={`${t('Bilan, Compte de Résultat et Tableau des Flux de Trésorerie (TFT) conformes aux normes OHADA pour l’exercice')} ${courant.libelle}.`}
      >
        <ExerciceFilter
          libelleAria={t('Exercice')}
          libelleBouton={t('Afficher')}
          exercices={exercices}
          selectionne={courant.id}
        />
      </PageHeader>

      <EtatsFinanciersClient
        etats={etats}
        devise={ctx.devise}
        lang={ctx.lang}
        organisationNom={ctx.organisationNom}
      />
    </>
  )
}
