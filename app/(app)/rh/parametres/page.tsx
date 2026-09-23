import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ActionButton } from '@/components/ActionButton'
import {
  addForfait, addPrimeAnciennete, addReductionFamille, chargerModelePaie, addRegle, addTrancheIr, basculerRegle, importerBareme, majParametrage,
  supprimerBareme, supprimerLigneParametre, supprimerRegle, validerParametrage,
} from '../actions'

const PERIODICITES = [
  { value: 'annuel', label: 'Barème annuel' },
  { value: 'mensuel', label: 'Barème mensuel' },
  { value: 'journalier', label: 'Barème journalier' },
]

export default async function ParametresPaiePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const fmt = (v: number | string | null) => formatMontant(v, '', ctx.lang)
  const periodicites = PERIODICITES.map((p) => ({ ...p, label: t(p.label) }))
  const supabase = await createClient()
  const [{ data: param }, { data: regles }, { data: versions }, { data: tranches }, { data: reductions }, { data: forfaits }, { data: anciennetes }] =
    await Promise.all([
      supabase.from('parametrage_paie').select('*').maybeSingle(),
      supabase.from('regles_paie').select('*').order('ordre').order('code'),
      supabase.from('v_baremes_versions').select('*').order('version'),
      supabase.from('bareme_ir').select('*').order('tranche_min'),
      supabase.from('reductions_famille').select('*').order('parts'),
      supabase.from('tranches_forfaitaires').select('*').order('periodicite').order('seuil_min'),
      supabase.from('primes_anciennete').select('*').order('annees_min'),
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
    g.details.push(`${t(v.periodicite)} : ${v.nb_lignes} ${t('lignes')} (${fmt(v.brut_min)} → ${fmt(v.brut_max)})`)
    groupes.set(cle, g)
  }

  return (
    <>
      <PageHeader
        titre={t('Paramétrage de la paie')}
        description={`${t('Pays')} : ${param?.pays ?? ctx.pays}. ${t('Aucun taux légal n’est figé dans le code : tout se règle ici, et toute modification impose une nouvelle validation.')}`}
      >
        <Link href="/rh/paie" className="text-sm text-primary underline">← {t('Paie')}</Link>
      </PageHeader>

      <Card className={`mb-6 ${valide ? 'border-success' : 'border-warning'}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{valide ? `${t('Paramétrage validé le')} ${formatDate(param?.valide_le, ctx.lang)}` : t('Paramétrage non validé')}</p>
            <p className="text-sm text-foreground-muted">
              {t('Vérifiez les cotisations, le barème et les plafonds au regard des textes en vigueur dans votre pays avant de valider.')}{' '}
              {t('Le calcul des bulletins est bloqué tant que la validation n’est pas faite.')}
            </p>
          </div>
          {admin && !valide && (
            <ActionButton
              label={t('Je confirme : valider le paramétrage')}
              variant="default"
              size="default"
              confirmation={t('Confirmez-vous avoir vérifié les taux, plafonds et barèmes (cotisations sociales, impôt) ?')}
              action={validerParametrage}
            />
          )}
        </div>
      </Card>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Impôt sur le revenu et TRIMF')}</h2>
      <Card className="mb-4 text-sm">
        <p>
          {t('Mode')} : <strong>{param?.mode_ir === 'table' ? t('lecture d’un barème de retenue importé') : t('calcul automatique (brut, parts, conjoints)')}</strong>
          {param?.mode_ir === 'table' && <> · {t('version')} <strong>{param?.bareme_version ?? '—'}</strong></>}
        </p>
        <p className="mt-1 text-foreground-muted">
          {t('Base de calcul par statut')} : {t('permanent')} → {per.permanent ?? '—'}, {t('saisonnier')} → {per.saisonnier ?? '—'}, {t('journalier')} → {per.journalier ?? '—'}.
          {param?.mode_ir !== 'table' && <> {t('Base = brut − abattement')} ({Number(param?.abattement_pct ?? 0)} %, {t('plafonné à')} {param?.abattement_plafond_annuel != null ? fmt(param.abattement_plafond_annuel) : t('aucun plafond')} {t('par an')}), {t('arrondie à')} {fmt(param?.arrondi_base ?? 0)}, {t('puis barème progressif et réduction pour charges de famille selon les parts.')}</>}
          {' '}{t('TRIMF = palier du brut × (1 + nombre de conjoints de l’employé).')}
        </p>
      </Card>
      <div className="mb-6 flex flex-wrap gap-2">
        <SimpleCreateForm
          titre={t('Modifier le mode de calcul')}
          disabled={!admin}
          action={majParametrage}
          champs={[
            { name: 'mode_ir', label: t('Mode'), type: 'select', required: true, defaultValue: param?.mode_ir ?? 'calcul', options: [{ value: 'calcul', label: t('Calcul automatique (recommandé)') }, { value: 'table', label: t('Lecture d’un barème de retenue importé') }] },
            { name: 'bareme_version', label: t('Mode table : version du barème importé'), defaultValue: param?.bareme_version ?? '' },
            { name: 'periodicite_permanent', label: t('Permanents lisent le barème'), type: 'select', defaultValue: per.permanent ?? 'annuel', options: periodicites },
            { name: 'periodicite_saisonnier', label: t('Saisonniers lisent le barème'), type: 'select', defaultValue: per.saisonnier ?? 'mensuel', options: periodicites },
            { name: 'periodicite_journalier', label: t('Journaliers lisent le barème'), type: 'select', defaultValue: per.journalier ?? 'journalier', options: periodicites },
            { name: 'jours_par_mois', label: t('Jours par mois (retenue d’absence)'), type: 'number', step: '0.5', defaultValue: String(param?.jours_par_mois ?? 30) },
            { name: 'jours_conge_par_mois', label: t('Jours de congé acquis par mois'), type: 'number', step: '0.01', defaultValue: String(param?.jours_conge_par_mois ?? 2) },
            { name: 'arrondi_base', label: t('Mode calcul : arrondi à l’inférieur de la base imposable (ex. 1000)'), type: 'number', step: '1', defaultValue: String(param?.arrondi_base ?? 0) },
            { name: 'ricf_mode', label: t('Réduction pour charges de famille'), type: 'select', required: true, defaultValue: param?.ricf_mode ?? 'parts', options: [{ value: 'parts', label: t('Selon le nombre de parts (tableau ci-dessous)') }, { value: 'familial', label: t('Pourcentage de l’impôt : taux marié + taux par enfant') }, { value: 'abattement_base', label: t('Abattement sur la base selon le nombre de charges (tableau ci-dessous, Niger)') }, { value: 'reduction_charge', label: t('Somme fixe par personne à charge déduite de l’impôt (Maroc)') }, { value: 'deduction_charge', label: t('Montant fixe déduit du revenu net par personne à charge (Togo)') }, { value: 'charges_impot', label: t('Pourcentage de l’impôt selon le nombre de charges (tableau ci-dessous, Burkina Faso)') }] },
            { name: 'ricf_marie_pct', label: t('Mode pourcentage : taux si marié (%)'), type: 'number', step: '0.001', defaultValue: String(param?.ricf_marie_pct ?? 0) },
            { name: 'ricf_par_enfant_pct', label: t('Mode pourcentage : taux par enfant (%)'), type: 'number', step: '0.001', defaultValue: String(param?.ricf_par_enfant_pct ?? 0) },
            { name: 'ricf_max_enfants', label: t('Mode pourcentage : nombre maximal d’enfants retenus'), type: 'number', defaultValue: String(param?.ricf_max_enfants ?? 10) },
            { name: 'reduction_pression_points', label: t('Diminution du taux de pression fiscale (points, ex. Mali : 2)'), type: 'number', step: '0.001', defaultValue: String(param?.reduction_pression_points ?? 0) },
            { name: 'abattement_pct', label: t('Mode calcul : abattement forfaitaire (%)'), type: 'number', step: '0.01', defaultValue: String(param?.abattement_pct ?? 0) },
            { name: 'abattement_plafond_annuel', label: t('Mode calcul : plafond annuel de l’abattement'), type: 'number', step: '0.01', defaultValue: param?.abattement_plafond_annuel != null ? String(param.abattement_plafond_annuel) : '' },
            { name: 'heures_normales_mois', label: t('Heures normales par mois (base horaire de la catégorie, prime d’ancienneté)'), type: 'number', step: '0.01', defaultValue: String(param?.heures_normales_mois ?? 173.33) },
            { name: 'mode_heures_sup', label: t('Heures supplémentaires'), type: 'select', required: true, defaultValue: param?.mode_heures_sup ?? 'pourcentage', options: [{ value: 'pourcentage', label: t('Nombre d’heures × salaire horaire de la catégorie × majoration') }, { value: 'forfait', label: t('Montant saisi directement par période') }] },
            { name: 'majoration_heures_sup_pct', label: t('Mode « pourcentage » : majoration des heures supplémentaires (%)'), type: 'number', step: '0.01', defaultValue: String(param?.majoration_heures_sup_pct ?? 0) },
          ]}
        />
        <SimpleCreateForm
          titre={t('Charger un modèle pays')}
          disabled={!admin}
          action={chargerModelePaie}
          champs={[
            {
              name: 'pays', label: t('Modèle (remplace les règles, barèmes et paramètres actuels)'), type: 'select', required: true,
              options: [
                { value: 'SN', label: t('Sénégal — barème officiel de retenue à la source, IPRES, CSS, CFCE') },
                { value: 'CI', label: t('Côte d’Ivoire — ITS et RICF (CGI art. 116 et 119 bis), CN, taxe d’apprentissage, FPC ; CNPS 6,3 % / 7,7 %') },
                { value: 'NE', label: t('Niger — ITS (CGI art. 60 à 66) : abattements 10 % et charges de famille, barème 1 à 35 % ; CNSS 5,25 % / 6,25 %') },
                { value: 'BJ', label: t('Bénin — ITS (CGI 2025 art. 125) barème 0 à 30 %, VPS 4 % ; CNSS 3,6 % / 6,4 % ; redevance ORTB non gérée') },
                { value: 'GH', label: t('Ghana — PAYE (GRA 2024) : barème 0 à 35 %, SSNIT 5,5 % déductible ; taux patronal à valider') },
                { value: 'ML', label: t('Mali — ITS (brochure DGI 2020) : INPS 3,6 % déductible, réduction familiale en %, −2 points ; INPS, AMO et ANPE inclus') },
                { value: 'GM', label: t('Gambie — PAYE (GRA, barème 2018) : 0 à 25 %, aucune déduction admise ; SSHFC 5 % / 10 %') },
                { value: 'NG', label: t('Nigeria — PAYE (Nigeria Tax Act 2025) : barème 0 à 25 %, pension 8 % et NHF 2,5 % déductibles ; loyer à saisir par employé') },
                { value: 'GN', label: t('Guinée — RTS (CGI 2022 art. 57-63) : barème 0 à 20 %, CNSS 5 % déductible, versement forfaitaire 6 %') },
                { value: 'MR', label: t('Mauritanie — ITS (CGI 2023 art. 110, 113, 114) : 6 000 MRU exonérés, barème 15 / 25 / 40 %, CNSS, CNAM, médecine du travail') },
                { value: 'MA', label: t('Maroc — IR salaires (CGI 2026 art. 59, 73, 74) : frais pro 35 % / 25 %, barème 0 à 37 %, 600 DH par charge, CNSS et AMO') },
                { value: 'TG', label: t('Togo — IRPP (CGI art. 26, 72-74) : abattement 28 %, 10 000 F par charge et par mois, barème 0 à 35 %, CNSS et AMU') },
                { value: 'BF', label: t('Burkina Faso — IUTS (CGI art. 60 à 62) : abattement 25 % (20 % cadres supérieurs à ajuster), barème 0 à 25 %, charges de famille 8 à 14 %, CNSS, TPA 3 %') },
              ],
            },
          ]}
        />
        <SimpleCreateForm
          titre={t('Importer un barème (CSV)')}
          disabled={!admin}
          action={importerBareme}
          champs={[
            { name: 'version', label: t('Nom de la version (ex. SN-2026)'), required: true },
            { name: 'pays', label: t('Pays (code ISO)'), defaultValue: ctx.pays },
            { name: 'fichier', label: t('Fichier CSV : periodicite, revenu_brut, trimf, ir_1, ir_1_5 … ir_5'), type: 'file', required: true, accept: '.csv,text/csv' },
          ]}
        />
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Barèmes de retenue à la source disponibles')}</h2>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr><th className={th}>{t('Version')}</th><th className={th}>{t('Pays')}</th><th className={th}>{t('Portée')}</th><th className={th}>{t('Contenu')}</th><th className={th}></th></tr>
          </thead>
          <tbody>
            {[...groupes.values()].map((g) => (
              <tr key={`${g.global}-${g.version}`}>
                <td className={td}>{g.version}{param?.bareme_version === g.version && <span className="ml-2 rounded bg-success/15 px-1.5 py-0.5 text-xs">{t('utilisée')}</span>}</td>
                <td className={td}>{g.pays}</td>
                <td className={td}>{g.global ? t('Référence (lecture seule)') : t('Propre à l’organisation')}</td>
                <td className={td}>{g.details.map((d, i) => <span key={i} className="block text-xs">{d}</span>)}</td>
                <td className={td}>
                  {admin && !g.global && (
                    <ActionButton label={t('Supprimer')} confirmation={t('Supprimer la version {v} ?', { v: g.version })} action={supprimerBareme.bind(null, g.version)} />
                  )}
                </td>
              </tr>
            ))}
            {groupes.size === 0 && (
              <tr><td className={td} colSpan={5}>{t('Aucun barème. Pour le Sénégal, importez supabase/seed/bareme_retenue_sn_2013.csv dans la table baremes_retenue (voir README).')}</td></tr>
            )}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Cotisations sociales et contributions')}</h2>
      <div className="mb-2 flex flex-wrap gap-2">
        <SimpleCreateForm
          titre={t('Nouvelle règle')}
          disabled={!admin}
          action={addRegle}
          champs={[
            { name: 'code', label: t('Code'), required: true },
            { name: 'libelle', label: t('Libellé'), required: true },
            { name: 'taux_salarie', label: t('Taux salarié (%)'), type: 'number', step: '0.001', defaultValue: '0' },
            { name: 'taux_employeur', label: t('Taux employeur (%)'), type: 'number', step: '0.001', defaultValue: '0' },
            { name: 'plancher_mensuel', label: t('Plancher mensuel (assiette = min(brut, plafond) − plancher)'), type: 'number', step: '0.01', defaultValue: '0' },
            { name: 'plafond_mensuel', label: t('Plafond mensuel (vide : sans plafond)'), type: 'number', step: '0.01' },
            { name: 'regime', label: t('Régime concerné'), type: 'select', options: [{ value: 'general', label: t('Régime général seul') }, { value: 'cadre', label: t('Cadres seulement') }] },
            { name: 'deductible_ir', label: t('Déductible de l’impôt (mode calcul)'), type: 'select', defaultValue: 'non', options: [{ value: 'oui', label: t('Oui') }, { value: 'non', label: t('Non') }] },
            { name: 'compte_cle', label: t('Compte de dette'), type: 'select', required: true, defaultValue: 'organismes_sociaux', options: [{ value: 'organismes_sociaux', label: t('431 — Organismes sociaux') }, { value: 'etat_impots_taxes', label: t('442 — État, impôts et taxes') }, { value: 'etat_retenues', label: t('447 — Impôts retenus à la source') }] },
            { name: 'ordre', label: t('Ordre d’affichage'), type: 'number', defaultValue: '10' },
          ]}
        />
      </div>
      <div className="mb-6">
        <TableWrap>
          <thead>
            <tr>
              <th className={th}>{t('Code')}</th><th className={th}>{t('Libellé')}</th>
              <th className={`${th} text-right`}>{t('Salarié')}</th><th className={`${th} text-right`}>{t('Employeur')}</th>
              <th className={`${th} text-right`}>{t('Plancher')}</th><th className={`${th} text-right`}>{t('Plafond')}</th>
              <th className={th}>{t('Régime')}</th><th className={th}></th>
            </tr>
          </thead>
          <tbody>
            {regles?.map((r) => (
              <tr key={r.id} className={r.actif ? '' : 'opacity-50'}>
                <td className={td}>{r.code}</td>
                <td className={td}>{t(r.libelle)}</td>
                <td className={`${td} text-right`}>{Number(r.taux_salarie)} %</td>
                <td className={`${td} text-right`}>{Number(r.taux_employeur)} %</td>
                <td className={`${td} text-right tabular-nums`}>{Number(r.plancher_mensuel) ? fmt(r.plancher_mensuel) : '—'}</td>
                <td className={`${td} text-right tabular-nums`}>{r.plafond_mensuel != null ? fmt(r.plafond_mensuel) : '—'}</td>
                <td className={td}>{r.regime === 'cadre' ? t('Cadres') : r.regime === 'general' ? t('Général') : t('Tous')}</td>
                <td className={td}>
                  {admin && (
                    <span className="flex gap-2">
                      <ActionButton label={r.actif ? t('Désactiver') : t('Activer')} action={basculerRegle.bind(null, r.id, !r.actif)} />
                      <ActionButton label={t('Supprimer')} confirmation={t('Supprimer la règle {c} ?', { c: r.code })} action={supprimerRegle.bind(null, r.id)} />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Calcul automatique : tranches d’impôt, réductions pour charges de famille, paliers de TRIMF')}</h2>
      <div className="mb-2 flex flex-wrap gap-2">
        <SimpleCreateForm titre={t('Tranche d’impôt')} disabled={!admin} action={addTrancheIr}
          champs={[
            { name: 'tranche_min', label: t('De (revenu annuel imposable)'), type: 'number', step: '0.01', required: true },
            { name: 'tranche_max', label: t('À (vide : sans limite)'), type: 'number', step: '0.01' },
            { name: 'taux', label: t('Taux (%)'), type: 'number', step: '0.001', required: true },
          ]} />
        <SimpleCreateForm titre={t('Réduction pour charges de famille')} disabled={!admin} action={addReductionFamille}
          champs={[
            { name: 'parts', label: t('Nombre de parts'), type: 'number', step: '0.5', required: true },
            { name: 'taux', label: t('Taux de réduction (% de l’impôt)'), type: 'number', step: '0.001', required: true },
            { name: 'minimum', label: t('Minimum'), type: 'number', step: '0.01', defaultValue: '0' },
            { name: 'maximum', label: t('Maximum'), type: 'number', step: '0.01' },
          ]} />
        <SimpleCreateForm titre={t('Palier de TRIMF')} disabled={!admin} action={addForfait}
          champs={[
            { name: 'periodicite', label: t('Périodicité du palier'), type: 'select', required: true, defaultValue: 'annuel', options: periodicites },
            { name: 'seuil_min', label: t('Brut de la période à partir de'), type: 'number', step: '0.01', required: true },
            { name: 'seuil_max', label: t('jusqu’à (vide : sans limite)'), type: 'number', step: '0.01' },
            { name: 'montant', label: t('Montant de la période (par personne)'), type: 'number', step: '0.01', required: true },
          ]} />
      </div>

      <h2 className="mb-2 font-heading text-lg font-semibold">{t('Prime d’ancienneté')}</h2>
      <Card className="mb-4 text-sm text-foreground-muted">
        {t('Barème par palier d’années de service, en % du salaire catégoriel de base (ou, s’il y a des heures supplémentaires sur la période, de (heures normales + heures sup) × salaire horaire de la catégorie). Ne s’applique qu’aux contrats rattachés à une catégorie salariale. Un employé ayant N années de service reçoit le taux du plus grand palier atteint.')}
      </Card>
      <div className="mb-2 flex flex-wrap gap-2">
        <SimpleCreateForm titre={t('Palier d’ancienneté')} disabled={!admin} action={addPrimeAnciennete}
          champs={[
            { name: 'annees_min', label: t('À partir de (années de service)'), type: 'number', required: true },
            { name: 'taux_pct', label: t('Taux (% du salaire catégoriel de base)'), type: 'number', step: '0.001', required: true },
          ]} />
      </div>
      <div className="mb-6">
        <Card>
          <p className="mb-2 text-sm font-medium">{t('Paliers actuels')}</p>
          {(anciennetes ?? []).length === 0 && <p className="text-xs text-foreground-muted">{t('Aucune ligne.')}</p>}
          <ul className="grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
            {anciennetes?.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>{t('{n} ans : {t} %', { n: a.annees_min, t: Number(a.taux_pct) })}</span>
                {admin && <ActionButton label={t('×')} action={supprimerLigneParametre.bind(null, 'primes_anciennete', a.id)} />}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {([
          [t('Tranches d’impôt'), tranches?.map((x) => ({ id: x.id, texte: `${fmt(x.tranche_min)} → ${x.tranche_max != null ? fmt(x.tranche_max) : '∞'} : ${Number(x.taux)} %` })), 'bareme_ir'],
          [t('Réductions de famille'), reductions?.map((r) => ({ id: r.id, texte: `${Number(r.parts)} ${t('parts')} : ${Number(r.taux)} % (min ${fmt(r.minimum)}, max ${r.maximum != null ? fmt(r.maximum) : '—'})` })), 'reductions_famille'],
          [t('Paliers de TRIMF'), forfaits?.map((f) => ({ id: f.id, texte: `${t(f.periodicite)} · ${t('dès')} ${fmt(f.seuil_min)} : ${Number(f.montant)}` })), 'tranches_forfaitaires'],
        ] as [string, { id: string; texte: string }[] | undefined, 'bareme_ir' | 'reductions_famille' | 'tranches_forfaitaires'][]).map(([titre, lignes, table]) => (
          <Card key={titre}>
            <p className="mb-2 text-sm font-medium">{titre}</p>
            {(lignes ?? []).length === 0 && <p className="text-xs text-foreground-muted">{t('Aucune ligne.')}</p>}
            <ul className="space-y-1 text-xs">
              {lignes?.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2">
                  <span>{l.texte}</span>
                  {admin && <ActionButton label={t('×')} action={supprimerLigneParametre.bind(null, table, l.id)} />}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  )
}
