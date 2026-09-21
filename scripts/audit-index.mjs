#!/usr/bin/env node
/**
 * Audit de performance statique : colonnes de clé étrangère sans index de tête.
 * Une clé étrangère sans index ralentit les jointures, les suppressions et le filtrage par organisation.
 *
 *   npm run audit:index
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dossier = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'supabase/migrations')
const sql = fs.readdirSync(dossier).filter((f) => f.endsWith('.sql')).sort().map((f) => fs.readFileSync(path.join(dossier, f), 'utf8').replace(/\r\n/g, '\n')).join('\n')

// tables et colonnes de clé étrangère (déclarées dans create table ou ajoutées par alter table ... add column)
const fks = []
for (const m of sql.matchAll(/create table (?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
  for (const c of m[2].matchAll(/^\s*(\w+)\s+[\w()]+[^,\n]*references\s+(\w+)/gim)) fks.push([m[1], c[1], c[2]])
}
for (const m of sql.matchAll(/alter table (?:public\.)?(\w+)([\s\S]*?);/gi)) {
  for (const c of m[2].matchAll(/add column (?:if not exists )?(\w+)\s+[\w()]+[^,;]*references\s+(\w+)/gi)) fks.push([m[1], c[1], c[2]])
}

// index de tête : create index ... on t (col, ...) ; clés primaires composites et contraintes unique (col, ...)
const indexes = new Set()
for (const m of sql.matchAll(/create (?:unique )?index\s+(?:\w+\s+)?on\s+(?:public\.)?(\w+)(?:\s+using\s+\w+)?\s*\(\s*(\w+)/gi)) indexes.add(`${m[1]}.${m[2]}`)
for (const m of sql.matchAll(/create table (?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
  for (const u of m[2].matchAll(/(?:unique|primary key)\s*\(\s*(\w+)/gi)) indexes.add(`${m[1]}.${u[1]}`)
  for (const u of m[2].matchAll(/^\s*(\w+)\s+[\w()]+[^,\n]*(?:primary key|unique)\b/gim)) indexes.add(`${m[1]}.${u[1]}`)
}

// Les clés vers organisations sont la porte d'entrée de toutes les requêtes (RLS) : on les liste à part.
const manquants = fks.filter(([t, c]) => !indexes.has(`${t}.${c}`))
const org = manquants.filter(([, c]) => c === 'organisation_id')
const autres = manquants.filter(([, c]) => c !== 'organisation_id')
console.log(`Clés étrangères : ${fks.length} · sans index de tête : ${manquants.length} (dont organisation_id : ${org.length})`)
if (org.length) console.log('\nTables filtrées par organisation sans index dédié (couvert par un index composite si organisation_id n\'est pas en tête) :\n  ' + org.map(([t]) => t).join(', '))
if (autres.length) console.log('\nAutres clés étrangères sans index :\n' + autres.map(([t, c, r]) => `  ${t}.${c} → ${r}`).join('\n'))
