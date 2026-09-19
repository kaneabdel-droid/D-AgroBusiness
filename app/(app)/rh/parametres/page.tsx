import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { formatDate, formatMontant } from '@/lib/utils'
import { Card, PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { ActionButton } from '@/components/ActionButton'
import {
  addForfait, addReductionFamille, addRegle, addTrancheIr, basculerRegle, importerBareme, majParametrage,
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
      supabase.from('tranches_forfaitaires').select('*').order('salaire_min_annuel'),
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
          Mode : <strong>{param?.mode_ir === 'table' ? 'lecture d’un barème de retenue à la source' : 'calcul (barème progressif, abattement, réductions de famille)'}</strong>
          {param?.mode_ir === 'table' && <> · version <strong>{param?.bareme_version ?? '—'}</strong></>}
        </p>
        {param?.mode_ir === 'table' && (
          <p className="mt-1 text-foreground-muted">
            Barème lu par statut : permanent → {per.permanent ?? '—'}, saisonnier → {per.saisonnier ?? '—'}, journalier → {per.journalier ?? '—'}.
            TRIMF = montant « par personne » du barème × (1 + nombre de conjoints de l&apos;employé).
          </p>
        )}
      </Card>
      <div className="mb-6 flex flex-wrap gap-2">
        <SimpleCreateForm
          titre="Modifier le mode de calcul"
          disabled={!admin}
          action={majParametrage}
          champs={[
            { name: 'mode_ir', label: 'Mode', type: 'select', required: true, defaultValue: param?.mode_ir ?? 'calcul', options: [{ value: 'table', label: 'Lecture d’un barème de retenue (table)' }, { value: 'calcul', label: 'Calcul (barème progressif)' }] },
            { name: 'bareme_version', label: 'Version du barème (mode table)', defaultValue: param?.bareme_version ?? '' },
            { name: 'periodicite_permanent', label: 'Permanents lisent le barème', type: 'select', defaultValue: per.permanent ?? 'annuel', options: PERIODICITES },
            { name: 'periodicite_saisonnier', label: 'Saisonniers lisent le barème', type: 'select', defaultValue: per.saisonnier ?? 'mensuel', options: PERIODICITES },
            { name: 'periodicite_journalier', label: 'Journaliers lisent le barème', type: 'select', defaultValue: per.journalier ?? 'journalier', options: PERIODICITES },
            { name: 'jours_par_mois', label: 'Jours par mois (retenue d’absence)', type: 'number', step: '0.5', defaultValue: String(param?.jours_par_mois ?? 30) },
            { name: 'jours_conge_par_mois', label: 'Jours de congé acquis par mois', type: 'number', step: '0.01', defaultValue: String(param?.jours_conge_par_mois ?? 2) },
            { name: 'abattement_pct', label: 'Mode calcul : abattement forfaitaire (%)', type: 'number', step: '0.01', defaultValue: String(param?.abattement_pct ?? 0) },
            { name: 'abattement_plafond_annuel', label: 'Mode calcul : plafond annuel de l’abattement', type: 'number', step: '0.01', defaultValue: param?.abattement_plafond_annuel != null ? String(param.abattement_plafond_annuel) : '' },
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

      <h2 className="mb-2 font-heading text-lg font-semibold">Mode « calcul » (pays sans barème de retenue) : tranches, réductions, forfaits</h2>
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
        <SimpleCreateForm titre="Forfait par tranche (TRIMF)" disabled={!admin} action={addForfait}
          champs={[
            { name: 'libelle', label: 'Libellé', defaultValue: 'TRIMF' },
            { name: 'salaire_min_annuel', label: 'Salaire annuel de', type: 'number', step: '0.01', required: true },
            { name: 'salaire_max_annuel', label: 'à (vide : sans limite)', type: 'number', step: '0.01' },
            { name: 'montant_annuel', label: 'Montant annuel', type: 'number', step: '0.01', required: true },
          ]} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {([
          ['Tranches d’impôt', tranches?.map((t) => ({ id: t.id, texte: `${formatMontant(t.tranche_min, '')} → ${t.tranche_max != null ? formatMontant(t.tranche_max, '') : '∞'} : ${Number(t.taux)} %` })), 'bareme_ir'],
          ['Réductions de famille', reductions?.map((r) => ({ id: r.id, texte: `${Number(r.parts)} parts : ${Number(r.taux)} % (min ${formatMontant(r.minimum, '')}, max ${r.maximum != null ? formatMontant(r.maximum, '') : '—'})` })), 'reductions_famille'],
          ['Forfaits TRIMF', forfaits?.map((f) => ({ id: f.id, texte: `${formatMontant(f.salaire_min_annuel, '')} → ${f.salaire_max_annuel != null ? formatMontant(f.salaire_max_annuel, '') : '∞'} : ${formatMontant(f.montant_annuel, '')} / an` })), 'tranches_forfaitaires'],
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
