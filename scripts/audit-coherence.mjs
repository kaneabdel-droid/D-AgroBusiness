#!/usr/bin/env node
/**
 * Audit de cohérence des données (lecture seule, toutes organisations, clé de service) :
 *  comptabilité (écritures équilibrées, balance équilibrée, exercices), stocks, lots, paie, financement, organisations et abonnements.
 *
 *   npm run audit:coherence
 *
 * Nécessite NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (fichier .env.local). Code de sortie 1 si une anomalie est trouvée.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let anomalies = 0
const controle = (nom, ok, detail = '') => {
  if (!ok) anomalies++
  console.log((ok ? 'OK  ' : 'KO  ') + nom + (detail ? '  -> ' + detail : ''))
}
/** Lit toute une table par pages de 1000 lignes. */
async function tout(table, colonnes = '*', filtre = (q) => q) {
  const lignes = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await filtre(admin.from(table).select(colonnes)).range(de, de + 999)
    if (error) throw new Error(`${table} : ${error.message}`)
    lignes.push(...data)
    if (data.length < 1000) break
  }
  return lignes
}
const somme = (xs, f) => xs.reduce((s, x) => s + Number(f(x)), 0)
const arrondi = (v) => Math.round(v * 100) / 100

// ---------- Comptabilité ----------
const lignes = await tout('lignes_ecritures', 'ecriture_id, organisation_id, compte_id, debit, credit')
const parEcriture = new Map()
for (const l of lignes) {
  const e = parEcriture.get(l.ecriture_id) ?? { d: 0, c: 0, n: 0 }
  e.d += Number(l.debit); e.c += Number(l.credit); e.n++
  parEcriture.set(l.ecriture_id, e)
}
const desequilibrees = [...parEcriture].filter(([, e]) => Math.abs(e.d - e.c) > 0.005)
controle('chaque écriture est équilibrée (débit = crédit)', desequilibrees.length === 0, `${parEcriture.size} écritures, ${desequilibrees.length} déséquilibrées`)
controle('chaque écriture a au moins deux lignes', [...parEcriture.values()].every((e) => e.n >= 2))

const orgs = await tout('organisations', 'id, nom, niveau, essai_expire_le, abonnement_expire_le, compte_verrouille')
for (const o of orgs) {
  const ls = lignes.filter((l) => l.organisation_id === o.id)
  const d = somme(ls, (l) => l.debit), c = somme(ls, (l) => l.credit)
  controle(`balance équilibrée — ${o.nom}`, Math.abs(d - c) < 0.01, `débit ${arrondi(d)} / crédit ${arrondi(c)}`)
}

const ecritures = await tout('ecritures', 'id, organisation_id, exercice_id, date_ecriture')
const exercices = new Map((await tout('exercices_comptables', 'id, organisation_id, date_debut, date_fin')).map((e) => [e.id, e]))
const horsExercice = ecritures.filter((e) => { const x = exercices.get(e.exercice_id); return !x || e.date_ecriture < x.date_debut || e.date_ecriture > x.date_fin || x.organisation_id !== e.organisation_id })
controle('chaque écriture est datée dans son exercice', horsExercice.length === 0, `${horsExercice.length} anomalie(s)`)
const ecritureIds = new Set(ecritures.map((e) => e.id))
controle('aucune ligne sans écriture', lignes.every((l) => ecritureIds.has(l.ecriture_id)))
const compteOrg = new Map((await tout('comptes_comptables', 'id, organisation_id')).map((c) => [c.id, c.organisation_id]))
controle('les lignes utilisent des comptes de leur organisation', lignes.every((l) => compteOrg.get(l.compte_id) === l.organisation_id))

// ---------- Stocks ----------
const mouvements = await tout('mouvements_stock', 'organisation_id, magasin_id, produit_id, propriete, contrat_depot_id, quantite, valeur')
const stock = new Map()
for (const m of mouvements) {
  const cle = [m.organisation_id, m.magasin_id, m.produit_id, m.propriete, m.contrat_depot_id ?? ''].join('|')
  const s = stock.get(cle) ?? { q: 0, v: 0 }
  s.q += Number(m.quantite); s.v += Number(m.valeur)
  stock.set(cle, s)
}
const negatifs = [...stock].filter(([, s]) => s.q < -0.0005)
controle('aucun stock négatif', negatifs.length === 0, `${stock.size} lignes de stock, ${negatifs.length} négatives`)
controle('stock propre : valeur nulle si quantité nulle', [...stock].every(([k, s]) => !k.includes('|propre|') || Math.abs(s.q) > 0.0005 || Math.abs(s.v) < 0.01))
const vStock = await tout('v_stock', 'organisation_id, magasin_id, produit_id, propriete, contrat_depot_id, quantite')
const ecartVue = vStock.filter((v) => { const s = stock.get([v.organisation_id, v.magasin_id, v.produit_id, v.propriete, v.contrat_depot_id ?? ''].join('|')); return !s || Math.abs(s.q - Number(v.quantite)) > 0.0005 })
controle('la vue des stocks concorde avec les mouvements', ecartVue.length === 0)

// ---------- Lots ----------
const lots = await tout('v_lots', 'id, numero, quantite_initiale, quantite_expediee, statut, nb_non_conformes')
controle('aucun lot expédié au-delà de sa quantité', lots.every((l) => Number(l.quantite_expediee) <= Number(l.quantite_initiale) + 0.0005))
controle('aucun lot libéré avec un contrôle non conforme', lots.every((l) => !(l.statut === 'libere' && Number(l.nb_non_conformes) > 0)))
const numeros = lots.map((l) => l.numero)
controle('numéros de lots uniques', new Set(numeros).size === numeros.length)

// ---------- Paie ----------
const bulletins = await tout('bulletins_paie', 'id, brut, total_retenues, net_a_payer, charges_patronales, cout_total, statut')
const ecartsPaie = bulletins.filter((b) => Math.abs(Number(b.brut) - Number(b.total_retenues) - Number(b.net_a_payer)) > 0.05 || Math.abs(Number(b.brut) + Number(b.charges_patronales) - Number(b.cout_total)) > 0.05)
controle('bulletins : net = brut − retenues et coût total = brut + charges patronales', ecartsPaie.length === 0, `${bulletins.length} bulletins, ${ecartsPaie.length} écart(s)`)
const periodes = await tout('periodes_paie', 'id, statut')
const bulletinsParPeriode = new Map()
for (const b of await tout('bulletins_paie', 'periode_id, statut')) bulletinsParPeriode.set(b.periode_id, (bulletinsParPeriode.get(b.periode_id) ?? 0) + 1)
controle('toute période validée ou payée a des bulletins', periodes.filter((p) => p.statut !== 'ouverte').every((p) => (bulletinsParPeriode.get(p.id) ?? 0) > 0))

// ---------- Financement ----------
const echeances = await tout('echeances_financement', 'id, statut, date_paiement')
const remboursements = await tout('remboursements_financement', 'echeance_id')
const rembEcheances = new Set(remboursements.map((r) => r.echeance_id))
controle('chaque échéance payée a un remboursement, et inversement', echeances.every((e) => (e.statut === 'payee') === rembEcheances.has(e.id)))

// ---------- Rapprochement bancaire ----------
const lignesReleve = await tout('lignes_releve', 'ligne_ecriture_id')
const pointees = lignesReleve.map((l) => l.ligne_ecriture_id).filter(Boolean)
controle('une écriture n’est pointée qu’une fois', new Set(pointees).size === pointees.length)

// ---------- Organisations, utilisateurs, abonnements ----------
const utilisateurs = await tout('utilisateurs', 'id, organisation_id, role, actif')
for (const o of orgs) {
  const admins = utilisateurs.filter((u) => u.organisation_id === o.id && u.role === 'admin' && u.actif)
  controle(`au moins un administrateur actif — ${o.nom}`, admins.length >= 1)
}
controle('niveaux d’abonnement valides', orgs.every((o) => ['standard', 'medium', 'premium'].includes(o.niveau)))
const paiements = await tout('abonnement_paiements', 'id, organisation_id, statut, provider_reference, montant, provider')
controle('paiements : montants strictement positifs', paiements.every((p) => Number(p.montant) > 0))
const refs = paiements.filter((p) => p.provider_reference).map((p) => `${p.provider}|${p.provider_reference}`)
controle('paiements : références de transaction uniques', new Set(refs).size === refs.length)
controle('paiements aboutis : l’organisation a un abonnement daté', paiements.filter((p) => p.statut === 'completed').every((p) => { const o = orgs.find((x) => x.id === p.organisation_id); return o && o.abonnement_expire_le }))

console.log(anomalies ? `\n${anomalies} anomalie(s).` : '\nOK : les données sont cohérentes.')
process.exit(anomalies ? 1 : 0)
