import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ActionButton } from '@/components/ActionButton'
import {
  addForfait, addReductionFamille, chargerModelePaie, addRegle, addTrancheIr, basculerRegle, importerBareme, majParametrage,
  supprimerBareme, supprimerLigneParametre, supprimerRegle, validerParametrage,
} from '../actions'

const PERIODICITES = [
  { value: 'annuel', label: 'Barème annuel' },
  { value: 'mensuel', label: 'Barème mensuel' },
  { value: 'journalier', label: 'Barème journalier' },
]

export default async function ParametresPaiePage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const [{ data: param }, { data: regles }, { data: versions }, { data: tranches }, { data: reductions }, { data: forfaits }] =
    await Promise.all([
      supabase.from('parametrage_paie').select('*').maybeSingle(),
      supabase.from('regles_paie').select('*').order('ordre').order('code'),
      supabase.from('v_baremes_versions').select('*').order('version'),
      supabase.from('bareme_ir').select('*').order('tranche_min'),
      supabase.from('reductions_famille').select('*').order('parts'),
      supabase.from('tranches_forfaitaires').select('*').order('periodicite').order('seuil_min'),
    ])
  const admin = ctx.role === 'admin'
  const valide = !!param?.valide_le
  const per = (param?.periodicite_par_statut ?? {}) as Record<string, string>

  // Versions regroupées (une ligne par version, avec le détail par périodicité)
  type Groupe = { version: string; pays: string; global: boolean; details: string[] }
  const groupes = new Map<string, Groupe>()
  for (const v of versions ?? []) {
    const cle = `${v.organisation_id ?? 'global'}:${v.version}`
    const g: Groupe = groupes.get(cle) ?? { version: v.version, pays: v.pays, global: !v.organisation_id, details: [] }
    g.details.push(`${v.periodicite} : ${v.nb_lignes} lignes (${formatMontant(v.brut_min, '')} → ${formatMontant(v.brut_max, '')})`)
    groupes.set(cle, g)
  }

  return (
    <>
      <PageHeader
        titre="Paramétrage de la paie"
        description={`Pays : ${param?.pays ?? ctx.pays}. Aucun taux légal n'est figé dans le code : tout se règle ici, et toute modification impose une nouvelle validation.`}
      >
        <Link href="/rh/paie" className="text-sm text-primary underline">← Paie</Link>
      </PageHeader>

      <Card className={`mb-6 ${valide ? 'border-success' : 'border-warning'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{valide ? `Paramétrage validé le ${formatDate(param?.valide_le)}` : 'Paramétrage non validé'}</p>
            <p className="text-sm text-foreground-muted">
              Vérifiez les cotisations, le barème et les plafonds au regard des textes en vigueur dans votre pays avant de valider.
              Le calcul des bulletins est bloqué tant que la validation n&apos;est pas faite.
            </p>
          </div>
          {admin && !valide && (
            <ActionButton
              label="Je confirme : valider le paramétrage"
              variant="default"
              size="default"
              confirmation="Confirmez-vous avoir vérifié les taux, plafonds et barèmes (cotisations sociales, impôt) ?"
              action={validerParametrage}
            />
          )}
        </div>
      </Card>

      <h2 className="mb-2 font-heading text-lg font-semibold">Impôt sur le revenu et TRIMF</h2>
      <Card className="mb-4 text-sm">
        <p>
          Mode : <strong>{param?.mode_ir === 'table' ? 'lecture d’un barème de retenue importé' : 'calcul automatique (brut, parts, conjoints)'}</strong>
          {param?.mode_ir === 'table' && <> · version <strong>{param?.bareme_version ?? '—'}</strong></>}
        </p>
        <p className="mt-1 text-foreground-muted">
          Base de calcul par statut : permanent → {per.permanent ?? '—'}, saisonnier → {per.saisonnier ?? '—'}, journalier → {per.journalier ?? '—'}.
          {param?.mode_ir !== 'table' && <> Base = brut − abattement ({Number(param?.abattement_pct ?? 0)} %, plafonné à {param?.abattement_plafond_annuel != null ? formatMontant(param.abattement_plafond_annuel, '') : 'aucun plafond'} par an), arrondie à {formatMontant(param?.arrondi_base ?? 0, '')}, puis barème progressif et réduction pour charges de famille selon les parts.</>}
          {' '}TRIMF = palier du brut × (1 + nombre de conjoints de l&apos;employé).
        </p>
      </Card>
      <div className="mb-6 flex flex-wrap gap-2">
        <SimpleCreateForm
          titre="Modifier le mode de calcul"
          disabled={!admin}
          action={majParametrage}
          champs={[
            { name: 'mode_ir', label: 'Mode', type: 'select', required: true, defaultValue: param?.mode_ir ?? 'calcul', options: [{ value: 'calcul', label: 'Calcul automatique (recommandé)' }, { value: 'table', label: 'Lecture d’un barème de retenue importé' }] },
            { name: 'bareme_version', label: 'Mode table : version du barème importé', defaultValue: param?.bareme_version ?? '' },
            { name: 'periodicite_permanent', label: 'Permanents lisent le barème', type: 'select', defaultValue: per.permanent ?? 'annuel', options: PERIODICITES },
            { name: 'periodicite_saisonnier', label: 'Saisonniers lisent le barème', type: 'select', defaultValue: per.saisonnier ?? 'mensuel', options: PERIODICITES },
            { name: 'periodicite_journalier', label: 'Journaliers lisent le barème', type: 'select', defaultValue: per.journalier ?? 'journalier', options: PERIODICITES },
            { name: 'jours_par_mois', label: 'Jours par mois (retenue d’absence)', type: 'number', step: '0.5', defaultValue: String(param?.jours_par_mois ?? 30) },
            { name: 'jours_conge_par_mois', label: 'Jours de congé acquis par mois', type: 'number', step: '0.01', defaultValue: String(param?.jours_conge_par_mois ?? 2) },
            { name: 'arrondi_base', label: 'Mode calcul : arrondi à l’inférieur de la base imposable (ex. 1000)', type: 'number', step: '1', defaultValue: String(param?.arrondi_base ?? 0) },
            { name: 'ricf_mode', label: 'Réduction pour charges de famille', type: 'select', required: true, defaultValue: param?.ricf_mode ?? 'parts', options: [{ value: 'parts', label: 'Selon le nombre de parts (tableau ci-dessous)' }, { value: 'familial', label: 'Pourcentage de l’impôt : taux marié + taux par enfant' }, { value: 'abattement_base', label: 'Abattement sur la base selon le nombre de charges (tableau ci-dessous, Niger)' }, { value: 'reduction_charge', label: 'Somme fixe par personne à charge déduite de l’impôt (Maroc)' }, { value: 'deduction_charge', label: 'Montant fixe déduit du revenu net par personne à charge (Togo)' }, { value: 'charges_impot', label: 'Pourcentage de l’impôt selon le nombre de charges (tableau ci-dessous, Burkina Faso)' }] },
            { name: 'ricf_marie_pct', label: 'Mode pourcentage : taux si marié (%)', type: 'number', step: '0.001', defaultValue: String(param?.ricf_marie_pct ?? 0) },
            { name: 'ricf_par_enfant_pct', label: 'Mode pourcentage : taux par enfant (%)', type: 'number', step: '0.001', defaultValue: String(param?.ricf_par_enfant_pct ?? 0) },
            { name: 'ricf_max_enfants', label: 'Mode pourcentage : nombre maximal d’enfants retenus', type: 'number', defaultValue: String(param?.ricf_max_enfants ?? 10) },
            { name: 'reduction_pression_points', label: 'Diminution du taux de pression fiscale (points, ex. Mali : 2)', type: 'number', step: '0.001', defaultValue: String(param?.reduction_pression_points ?? 0) },
            { name: 'abattement_pct', label: 'Mode calcul : abattement forfaitaire (%)', type: 'number', step: '0.01', defaultValue: String(param?.abattement_pct ?? 0) },
            { name: 'abattement_plafond_annuel', label: 'Mode calcul : plafond annuel de l’abattement', type: 'number', step: '0.01', defaultValue: param?.abattement_plafond_annuel != null ? String(param.abattement_plafond_annuel) : '' },
          ]}
        />
        <SimpleCreateForm
          titre="Charger un modèle pays"
          disabled={!admin}
          action={chargerModelePaie}
          champs={[
            {
              name: 'pays', label: 'Modèle (remplace les règles, barèmes et paramètres actuels)', type: 'select', required: true,
              options: [
                { value: 'SN', label: 'Sénégal — barème officiel de retenue à la source, IPRES, CSS, CFCE' },
                { value: 'CI', label: 'Côte d’Ivoire — ITS et RICF (CGI art. 116 et 119 bis), CN, taxe d’apprentissage, FPC ; CNPS 6,3 % / 7,7 %' },
                { value: 'NE', label: 'Niger — ITS (CGI art. 60 à 66) : abattements 10 % et charges de famille, barème 1 à 35 % ; CNSS 5,25 % / 6,25 %' },
                { value: 'BJ', label: 'Bénin — ITS (CGI 2025 art. 125) barème 0 à 30 %, VPS 4 % ; CNSS 3,6 % / 6,4 % ; redevance ORTB non gérée' },
                { value: 'GH', label: 'Ghana — PAYE (GRA 2024) : barème 0 à 35 %, SSNIT 5,5 % déductible ; taux patronal à valider' },
                { value: 'ML', label: 'Mali — ITS (brochure DGI 2020) : INPS 3,6 % déductible, réduction familiale en %, −2 points ; INPS, AMO et ANPE inclus' },
                { value: 'GN', label: 'Guinée — RTS (CGI 2022 art. 57-63) : barème 0 à 20 %, CNSS 5 % déductible, versement forfaitaire 6 %' },
                { value: 'MR', label: 'Mauritanie — ITS (CGI 2023 art. 110, 113, 114) : 6 000 MRU exonérés, barème 15 / 25 / 40 %, CNSS, CNAM, médecine du travail' },
                { value: 'MA', label: 'Maroc — IR salaires (CGI 2026 art. 59, 73, 74) : frais pro 35 % / 25 %, barème 0 à 37 %, 600 DH par charge, CNSS et AMO' },
                { value: 'TG', label: 'Togo — IRPP (CGI art. 26, 72-74) : abattement 28 %, 10 000 F par charge et par mois, barème 0 à 35 %, CNSS et AMU' },
                { value: 'BF', label: 'Burkina Faso — IUTS (CGI art. 60 à 62) : abattement 25 % (20 % cadres supérieurs à ajuster), barème 0 à 25 %, charges de famille 8 à 14 %, CNSS, TPA 3 %' },
              ],
            },
          ]}
        />
        <SimpleCreateForm
          titre="Importer un barème (CSV)"
          disabled={!admin}
          action={importerBareme}
          champs={[
            { name: 'version', label: 'Nom de la version (ex. SN-2026)', required: true },
            { name: 'pays', label: 'Pays (code ISO)', defaultValue: ctx.pays },
            { name: 'fichier', label: 'Fichier CSV : periodicite, revenu_brut, trimf, ir_1, ir_1_5 … ir_5', type: 'file', required: true, accept: '.csv,text/csv' },
          ]}
        />
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Barèmes de retenue à la source disponibles</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr><th className={th}>Version</th><th className={th}>Pays</th><th className={th}>Portée</th><th className={th}>Contenu</th><th className={th}></th></tr>
          </thead>
          <tbody>
            {[...groupes.values()].map((g) => (
              <tr key={`${g.global}-${g.version}`}>
                <td className={td}>{g.version}{param?.bareme_version === g.version && <span className="ml-2 rounded bg-success/15 px-1.5 py-0.5 text-xs">utilisée</span>}</td>
                <td className={td}>{g.pays}</td>
                <td className={td}>{g.global ? 'Référence (lecture seule)' : 'Propre à l’organisation'}</td>
                <td className={td}>{g.details.map((d, i) => <span key={i} className="block text-xs">{d}</span>)}</td>
                <td className={td}>
                  {admin && !g.global && (
                    <ActionButton label="Supprimer" confirmation={`Supprimer la version ${g.version} ?`} action={supprimerBareme.bind(null, g.version)} />
                  )}
                </td>
              </tr>
            ))}
            {groupes.size === 0 && (
              <tr><td className={td} colSpan={5}>Aucun barème. Pour le Sénégal, importez supabase/seed/bareme_retenue_sn_2013.csv dans la table baremes_retenue (voir README).</td></tr>
            )}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Cotisations sociales et contributions</h2>
      <div className="mb-2 flex flex-wrap gap-2">
        <SimpleCreateForm
          titre="Nouvelle règle"
          disabled={!admin}
          action={addRegle}
          champs={[
            { name: 'code', label: 'Code', required: true },
            { name: 'libelle', label: 'Libellé', required: true },
            { name: 'taux_salarie', label: 'Taux salarié (%)', type: 'number', step: '0.001', defaultValue: '0' },
            { name: 'taux_employeur', label: 'Taux employeur (%)', type: 'number', step: '0.001', defaultValue: '0' },
            { name: 'plancher_mensuel', label: 'Plancher mensuel (assiette = min(brut, plafond) − plancher)', type: 'number', step: '0.01', defaultValue: '0' },
            { name: 'plafond_mensuel', label: 'Plafond mensuel (vide : sans plafond)', type: 'number', step: '0.01' },
            { name: 'regime', label: 'Régime concerné', type: 'select', options: [{ value: 'general', label: 'Régime général seul' }, { value: 'cadre', label: 'Cadres seulement' }] },
            { name: 'deductible_ir', label: 'Déductible de l’impôt (mode calcul)', type: 'select', defaultValue: 'non', options: [{ value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }] },
            { name: 'compte_cle', label: 'Compte de dette', type: 'select', required: true, defaultValue: 'organismes_sociaux', options: [{ value: 'organismes_sociaux', label: '431 — Organismes sociaux' }, { value: 'etat_impots_taxes', label: '442 — État, impôts et taxes' }, { value: 'etat_retenues', label: '447 — Impôts retenus à la source' }] },
            { name: 'ordre', label: 'Ordre d’affichage', type: 'number', defaultValue: '10' },
          ]}
        />
      </div>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>Code</th><th className={th}>Libellé</th>
              <th className={`${th} text-right`}>Salarié</th><th className={`${th} text-right`}>Employeur</th>
              <th className={`${th} text-right`}>Plancher</th><th className={`${th} text-right`}>Plafond</th>
              <th className={th}>Régime</th><th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {regles?.map((r) => (
              <tr key={r.id} className={r.actif ? '' : 'opacity-50'}>
                <td className={td}>{r.code}</td>
                <td className={td}>{r.libelle}</td>
                <td className={`${td} text-right`}>{Number(r.taux_salarie)} %</td>
                <td className={`${td} text-right`}>{Number(r.taux_employeur)} %</td>
                <td className={`${td} text-right tabular-nums`}>{Number(r.plancher_mensuel) ? formatMontant(r.plancher_mensuel, '') : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{r.plafond_mensuel != null ? formatMontant(r.plafond_mensuel, '') : '—'}</td>
                <td className={td}>{r.regime === 'cadre' ? 'Cadres' : r.regime === 'general' ? 'Général' : 'Tous'}</td>
                <td className={td}>
                  {admin && (
                    <span className="flex gap-2">
                      <ActionButton label={r.actif ? 'Désactiver' : 'Activer'} action={basculerRegle.bind(null, r.id, !r.actif)} />
                      <ActionButton label="Supprimer" confirmation={`Supprimer la règle ${r.code} ?`} action={supprimerRegle.bind(null, r.id)} />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">Calcul automatique : tranches d’impôt, réductions pour charges de famille, paliers de TRIMF</h2>
      <div className="mb-2 flex flex-wrap gap-2">
        <SimpleCreateForm titre="Tranche d'impôt" disabled={!admin} action={addTrancheIr}
          champs={[
            { name: 'tranche_min', label: 'De (revenu annuel imposable)', type: 'number', step: '0.01', required: true },
            { name: 'tranche_max', label: 'À (vide : sans limite)', type: 'number', step: '0.01' },
            { name: 'taux', label: 'Taux (%)', type: 'number', step: '0.001', required: true },
          ]} />
        <SimpleCreateForm titre="Réduction pour charges de famille" disabled={!admin} action={addReductionFamille}
          champs={[
            { name: 'parts', label: 'Nombre de parts', type: 'number', step: '0.5', required: true },
            { name: 'taux', label: 'Taux de réduction (% de l’impôt)', type: 'number', step: '0.001', required: true },
            { name: 'minimum', label: 'Minimum', type: 'number', step: '0.01', defaultValue: '0' },
            { name: 'maximum', label: 'Maximum', type: 'number', step: '0.01' },
          ]} />
        <SimpleCreateForm titre="Palier de TRIMF" disabled={!admin} action={addForfait}
          champs={[
            { name: 'periodicite', label: 'Périodicité du palier', type: 'select', required: true, defaultValue: 'annuel', options: PERIODICITES },
            { name: 'seuil_min', label: 'Brut de la période à partir de', type: 'number', step: '0.01', required: true },
            { name: 'seuil_max', label: 'jusqu’à (vide : sans limite)', type: 'number', step: '0.01' },
            { name: 'montant', label: 'Montant de la période (par personne)', type: 'number', step: '0.01', required: true },
          ]} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {([
          ['Tranches d’impôt', tranches?.map((t) => ({ id: t.id, texte: `${formatMontant(t.tranche_min, '')} → ${t.tranche_max != null ? formatMontant(t.tranche_max, '') : '∞'} : ${Number(t.taux)} %` })), 'bareme_ir'],
          ['Réductions de famille', reductions?.map((r) => ({ id: r.id, texte: `${Number(r.parts)} parts : ${Number(r.taux)} % (min ${formatMontant(r.minimum, '')}, max ${r.maximum != null ? formatMontant(r.maximum, '') : '—'})` })), 'reductions_famille'],
          ['Paliers de TRIMF', forfaits?.map((f) => ({ id: f.id, texte: `${f.periodicite} · dès ${formatMontant(f.seuil_min, '')} : ${Number(f.montant)}` })), 'tranches_forfaitaires'],
        ] as [string, { id: string; texte: string }[] | undefined, 'bareme_ir' | 'reductions_famille' | 'tranches_forfaitaires'][]).map(([titre, lignes, table]) => (
          <Card key={titre}>
            <p className="mb-2 text-sm font-medium">{titre}</p>
            {(lignes ?? []).length === 0 && <p className="text-xs text-foreground-muted">Aucune ligne.</p>}
            <ul className="space-y-1 text-xs">
              {lignes?.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span>{l.texte}</span>
                  {admin && <ActionButton label="×" action={supprimerLigneParametre.bind(null, table, l.id)} />}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  )
}
