#!/usr/bin/env node
/**
 * Contrôle des traductions : l'application est maintenue en trois langues (français, anglais, arabe).
 *
 * Le texte français sert de clé (`t('Tableau de bord')`). Ce script recense tous les textes visibles ou renvoyés à l'utilisateur :
 *   - les appels t('…') dans app/, components/ et lib/ ;
 *   - les libellés de constantes (label:, titre:, tables de correspondance de type Record) ;
 *   - les messages d'erreur des actions serveur (error: '…') et des exceptions SQL (raise exception '…') ;
 *   - les libellés créés par les migrations (règles de paie, départements, journaux, magasin) ;
 * puis vérifie que chacun figure dans lib/i18n-en.ts et lib/i18n-ar.ts, que les marqueurs ({nom}, §) sont conservés et que la
 * traduction arabe contient bien de l'arabe. Code de sortie 1 en cas d'écart (utilisé avant `npm run build`).
 *
 *   npm run i18n:check           contrôle complet
 *   npm run i18n:check -- --orphelines   liste aussi les clés de dictionnaire qui ne sont plus utilisées
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8').replace(/\r\n/g, '\n')
const afficherOrphelines = process.argv.includes('--orphelines')

// ---------- dictionnaires ----------
const reEntree = /"((?:[^"\\]|\\.)*)": "((?:[^"\\]|\\.)*)"/g
function dictionnaire(fichier) {
  const map = new Map()
  const doublons = []
  for (const m of lire(fichier).matchAll(reEntree)) {
    if (map.has(m[1])) doublons.push(m[1])
    map.set(m[1], m[2])
  }
  return { map, doublons }
}
const EN = dictionnaire('lib/i18n-en.ts')
const AR = dictionnaire('lib/i18n-ar.ts')

// ---------- textes attendus ----------
const requis = new Map() // clé -> origine
const ajouter = (texte, origine) => {
  const cle = texte.replace(/\\'/g, "'").trim()
  if (!cle || cle.startsWith('/') || !/\p{L}{2,}/u.test(cle)) return   // les chemins de navigation ne sont pas des textes
  if (!requis.has(cle)) requis.set(cle, origine)
}

function fichiers(dir, acc = []) {
  for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
    const p = path.posix.join(dir, e.name)
    if (e.isDirectory()) {
      if (!['node_modules', '.next', 'ui'].includes(e.name)) fichiers(p, acc)
    } else if (/\.(ts|tsx)$/.test(e.name) && !/i18n/.test(e.name)) acc.push(p)
  }
  return acc
}

for (const f of [...fichiers('app'), ...fichiers('components'), ...fichiers('lib')]) {
  const src = lire(f)
  // appels t('…')
  for (const m of src.matchAll(/\bt\('((?:[^'\\\n]|\\.)*)'/g)) ajouter(m[1], f)
  // libellés de constantes
  for (const m of src.matchAll(/\b(?:label|titre|titreTiers|bouton): '((?:[^'\\\n]|\\.)*)'/g)) ajouter(m[1], f)
  // tables de correspondance : const X: Record<…> = { clé: 'Texte', … } (les valeurs sont traduites à l'affichage)
  for (const b of src.matchAll(/const \w+: Record<[^=]*=\s*\{([\s\S]*?)\n?\}/g)) {
    for (const v of b[1].matchAll(/:\s*'((?:[^'\\\n]|\\.)*)'/g)) ajouter(v[1], f)
  }
  // séries de mois
  for (const b of src.matchAll(/const MOIS\s*=\s*\[([\s\S]*?)\]/g)) for (const v of b[1].matchAll(/'([^']+)'/g)) ajouter(v[1], f)
  // messages d'erreur renvoyés par les actions serveur
  for (const m of src.matchAll(/error:\s*'((?:[^'\\\n]|\\.)*)'/g)) ajouter(m[1], f)
  for (const m of src.matchAll(/error:\s*`((?:[^`\\]|\\.)*)`/g)) ajouter(m[1].replace(/\$\{[^}]*\}/g, '§'), f)
}

// migrations : exceptions SQL, libellés de règles de paie du modèle le plus récent, données créées à l'inscription
const migrations = fs.readdirSync(path.join(racine, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()
for (const f of migrations) {
  const src = lire('supabase/migrations/' + f)
  for (const m of src.matchAll(/raise exception\s+'((?:[^']|'')*)'/g)) {
    ajouter(m[1].replace(/''/g, '’').replace(/'/g, '’').replace(/%/g, '§'), f)
  }
}
const dernierModele = [...migrations].reverse().find((f) => lire('supabase/migrations/' + f).includes('function appliquer_modele_paie'))
if (dernierModele) {
  for (const m of lire('supabase/migrations/' + dernierModele).matchAll(/\(p_org, '[A-Z_]+', '((?:[^']|'')*)'/g)) {
    const libelle = m[1].replace(/''/g, "'")
    if (!/^TRIMF$/.test(libelle)) ajouter(libelle, dernierModele)
  }
}
for (const f of ['supabase/migrations/01_comptabilite.sql', 'supabase/migrations/02_operations.sql']) {
  const src = lire(f)
  for (const m of src.matchAll(/\(p_org, '(?:FONC|DIST|PROD|USIN|MATE|ACH|VTE|BQ1|CAI|PAI|STK|OD|AN|MAG1)', '((?:[^']|'')*)'/g)) ajouter(m[1].replace(/''/g, "'"), f)
}
// libellés générés par le calcul de paie (base de données)
for (const l of ['Salaire de base', 'Salaire (jours travaillés × taux journalier)', 'Primes et indemnités', 'Retenue pour absences non payées', 'Impôt sur le revenu',
  '(part employeur)', 'TRIMF ({n} personne(s))']) ajouter(l, 'calcul de paie')

// ---------- vérifications ----------
const problemes = []
const marqueurs = (s) => [...(s.match(/\{\w+\}/g) ?? [])].sort().join(',') + '|' + (s.match(/§/g) ?? []).length
const contientArabe = (s) => /[؀-ۿ]/.test(s)
const contientLatin = (s) => (s.match(/[A-Za-z]/g) ?? []).length >= 3

const cle = (k) => k.replace(/'/g, '’')
const trouver = (dico, k) => dico.map.has(k) ? dico.map.get(k) : dico.map.get(cle(k)) ?? dico.map.get(k.replace(/’/g, "'"))

const manquantsEn = []
const manquantsAr = []
for (const [k, origine] of requis) {
  const en = trouver(EN, k)
  const ar = trouver(AR, k)
  if (en === undefined) manquantsEn.push([k, origine])
  if (ar === undefined) manquantsAr.push([k, origine])
  if (en !== undefined && marqueurs(en) !== marqueurs(k)) problemes.push(`marqueurs différents (EN) : « ${k} »`)
  if (ar !== undefined && marqueurs(ar) !== marqueurs(k)) problemes.push(`marqueurs différents (AR) : « ${k} »`)
  if (ar !== undefined && contientLatin(k) && !contientArabe(ar)) problemes.push(`traduction arabe sans caractère arabe : « ${k} » → « ${ar} »`)
}
for (const [k, v] of EN.map) if (!v.trim()) problemes.push(`traduction anglaise vide : « ${k} »`)
for (const [k, v] of AR.map) if (!v.trim()) problemes.push(`traduction arabe vide : « ${k} »`)
for (const d of EN.doublons) problemes.push(`clé en double (EN) : « ${d} »`)
for (const d of AR.doublons) problemes.push(`clé en double (AR) : « ${d} »`)

// ---------- rapport ----------
const ligne = ([k, o]) => `    « ${k.length > 110 ? k.slice(0, 107) + '…' : k} »   (${o})`
console.log(`Textes recensés : ${requis.size} — dictionnaire anglais : ${EN.map.size} — dictionnaire arabe : ${AR.map.size}`)
if (manquantsEn.length) console.log(`\nMANQUE EN ANGLAIS (${manquantsEn.length}) :\n${manquantsEn.map(ligne).join('\n')}`)
if (manquantsAr.length) console.log(`\nMANQUE EN ARABE (${manquantsAr.length}) :\n${manquantsAr.map(ligne).join('\n')}`)
if (problemes.length) console.log(`\nPROBLÈMES (${problemes.length}) :\n${problemes.map((p) => '    ' + p).join('\n')}`)
if (afficherOrphelines) {
  const utilisees = new Set([...requis.keys()].map(cle))
  const orphelines = [...EN.map.keys()].filter((k) => !utilisees.has(cle(k)) && !requis.has(k))
  console.log(`\nCLÉS DE DICTIONNAIRE NON RÉFÉRENCÉES (${orphelines.length}, à titre d'information) :\n${orphelines.slice(0, 80).map((k) => '    « ' + k.slice(0, 100) + ' »').join('\n')}`)
}
const ok = !manquantsEn.length && !manquantsAr.length && !problemes.length
console.log(ok ? '\nOK : tous les textes existent en français, anglais et arabe.' : '\nÉCHEC : complétez lib/i18n-en.ts et lib/i18n-ar.ts (voir la règle des trois langues dans le README).')
process.exit(ok ? 0 : 1)
