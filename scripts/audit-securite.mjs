#!/usr/bin/env node
/**
 * Audit de sécurité statique des migrations SQL :
 *  1. toute table créée a la sécurité par lignes (RLS) activée ;
 *  2. toute table à RLS a au moins une policy (sinon elle n'est lisible que par la clé de service : à vérifier) ;
 *  3. toute fonction « security definer » fixe son search_path ;
 *  4. toute fonction « security definer » est soit verrouillée pour anon (revoke ... anon), soit explicitement publique ;
 *  5. aucune clé secrète n'est écrite dans les fichiers suivis par Git.
 *
 *   npm run audit:securite            rapport complet, code 1 en cas d'écart bloquant
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dossier = path.join(racine, 'supabase/migrations')
const sql = fs.readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort().map((f) => [f, fs.readFileSync(path.join(dossier, f), 'utf8').replace(/\r\n/g, '\n')])
const tout = sql.map(([, s]) => s).join('\n')

const problemes = []
const infos = []

// 1 & 2 — tables, RLS, policies
const tables = [...tout.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)/gi)].map((m) => m[1])
const rls = new Set([...tout.matchAll(/alter table (?:public\.)?(\w+) enable row level security/gi)].map((m) => m[1]))
const avecPolicy = new Set([...tout.matchAll(/create policy \w+ on (?:public\.)?(\w+)/gi)].map((m) => m[1]))
// tables dont les policies sont créées dans une boucle DO (nom passé en paramètre) : recensées par leur tableau
for (const m of tout.matchAll(/foreach t in array array\[([^\]]+)\]/gi)) for (const t of m[1].matchAll(/'(\w+)'/g)) avecPolicy.add(t[1])
for (const t of tables) {
  if (!rls.has(t)) problemes.push(`table sans RLS : ${t}`)
  else if (!avecPolicy.has(t)) infos.push(`table à RLS sans policy (accessible par la clé de service uniquement) : ${t}`)
}

// 3 & 4 — fonctions security definer
const fonctions = [...tout.matchAll(/create (?:or replace )?function (\w+)\s*\(([^)]*)\)([\s\S]*?)(?:\$\$|\$[a-z]+\$)/gi)]
const definer = new Map()
for (const m of fonctions) {
  const entete = m[3]
  if (/security definer/i.test(entete)) {
    const nom = m[1]
    if (!/set search_path/i.test(entete)) problemes.push(`fonction security definer sans search_path : ${nom}`)
    definer.set(nom, true)
  }
}
const revoques = new Set()
for (const m of tout.matchAll(/revoke (?:all|execute) on function\s+([\s\S]*?)\s+from\s+([^;]+);/gi)) {
  if (/anon|public/i.test(m[2])) for (const f of m[1].matchAll(/(\w+)\s*\(/g)) revoques.add(f[1])
}
// fonctions de déclenchement (triggers) : non appelables via l'API
const declencheurs = new Set([...tout.matchAll(/create (?:or replace )?function (\w+)\s*\(\s*\)\s*returns trigger/gi)].map((m) => m[1]))
// Appelables sans connexion volontairement : l'aide aux policies RLS (elles ne renvoient que le contexte de l'appelant, vide pour anon)
// et invitation_en_attente (formulaire d'inscription)
const publiques = new Set(['invitation_en_attente', 'current_org_id', 'current_role_utilisateur', 'has_role', 'departements_accessibles'])
for (const nom of definer.keys()) {
  if (!revoques.has(nom) && !declencheurs.has(nom) && !publiques.has(nom)) problemes.push(`fonction security definer appelable par anon (pas de revoke) : ${nom}`)
}

// 5 — secrets dans les fichiers suivis
try {
  const suivis = execSync('git ls-files', { cwd: racine, encoding: 'utf8' }).split('\n').filter(Boolean)
  const motifs = [/service_role['"]?\s*[:=]\s*['"]?eyJ/i, /sb_secret_[A-Za-z0-9_-]{20,}/, /eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}/, /(API_KEY|SECRET|TOKEN)\s*=\s*[A-Za-z0-9_-]{24,}/]
  for (const f of suivis) {
    if (/\.(png|jpg|svg|xls|ico|lock)$|package-lock/.test(f)) continue
    let contenu
    try { contenu = fs.readFileSync(path.join(racine, f), 'utf8') } catch { continue }
    for (const re of motifs) if (re.test(contenu)) problemes.push(`secret possible dans un fichier suivi : ${f}`)
  }
  if (suivis.some((f) => /^\.env(\.local)?$/.test(f))) problemes.push('un fichier .env est suivi par Git')
} catch {
  infos.push('vérification des secrets ignorée (Git indisponible)')
}

console.log(`Tables : ${tables.length} · avec RLS : ${tables.filter((t) => rls.has(t)).length} · fonctions security definer : ${definer.size} · verrouillées pour anon : ${[...definer.keys()].filter((f) => revoques.has(f)).length}`)
for (const i of infos) console.log('INFO  ' + i)
for (const p of problemes) console.log('KO    ' + p)
console.log(problemes.length ? `\n${problemes.length} écart(s) bloquant(s).` : '\nOK : aucun écart bloquant.')
process.exit(problemes.length ? 1 : 0)
