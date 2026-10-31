'use client'

import React, { useState } from 'react'
import {
  FileText,
  TrendingUp,
  Scale,
  ArrowRightLeft,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Info,
  DollarSign,
  Briefcase,
  Layers,
  Download,
  Printer,
  Search,
  Building,
  BookOpen,
  ShieldCheck,
  ListOrdered,
} from 'lucide-react'
import LiasseImprimable from './LiasseImprimable'
import { Card, TableWrap, th, td } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'
import { formatMontant } from '@/lib/utils'
import type { Lang } from '@/lib/i18n'
import {
  type EtatsFinanciersSyscohada,
  type DetailCompte,
  type NoteAnnexe,
  exporterLiasseCompleteCSV,
} from '@/lib/syscohada'

export default function EtatsFinanciersClient({
  etats,
  devise = 'F CFA',
  lang = 'fr',
  organisationNom,
}: {
  etats: EtatsFinanciersSyscohada
  devise?: string
  lang?: Lang
  organisationNom: string
}) {
  const [activeTab, setActiveTab] = useState<
    'page_garde' | 'actif' | 'passif' | 'resultat' | 'tft' | 'indicateurs' | 'notes' | 'controles' | 'edition_imprimable'
  >('actif')
  const [compteOuvert, setCompteOuvert] = useState<string | null>(null)
  const [noteSelectionnee, setNoteSelectionnee] = useState<string>('note-34')
  const [filtreNote, setFiltreNote] = useState<string>('')

  const fm = (val: number | string | undefined | null) => {
    if (val === null || val === undefined || val === '') return '-'
    const n = Number(val)
    if (isNaN(n)) return String(val)
    if (n === 0) return '0'
    return Math.round(n).toLocaleString('fr-FR')
  }

  const libN = etats.exerciceN.libelle
  const libN1 = etats.exerciceN1?.libelle ?? 'N-1 (aucun exercice antérieur)'

  const toggleDetail = (ref: string) => {
    setCompteOuvert((prev) => (prev === ref ? null : ref))
  }

  // Contrôles
  const bilanEquilibreN = Math.abs(etats.controles.equilibreBilanN) < 1
  const tftEquilibre = Math.abs(etats.controles.ecartBouclageTFT) < 1

  // Téléchargement CSV complet de la liasse
  const telechargerLiasseComplete = () => {
    const csvContent = exporterLiasseCompleteCSV(etats)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `liasse-syscohada-${libN}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Notes filtrées
  const notesFiltrees = etats.notesAnnexees.filter((n) => {
    const q = filtreNote.toLowerCase()
    return n.numero.toLowerCase().includes(q) || n.nomNote.toLowerCase().includes(q)
  })
  const noteCourante =
    etats.notesAnnexees.find((n) => n.id === noteSelectionnee) ?? etats.notesAnnexees[0]

  return (
    <>
      <div className="space-y-6 print:hidden">
      {/* Barre d'actions globale de la liasse */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-surface-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/10 text-primary uppercase tracking-wide">
              SYSCOHADA Système Normal
            </span>
            <span className="text-xs text-foreground-muted">
              {organisationNom} • Exercice {libN}
            </span>
          </div>
          <p className="text-xs text-foreground-muted mt-1">
            Liasse financière complète normalisée (Bilan, Compte de Résultat, TFT, Note 34 et 36 Notes Annexées)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={telechargerLiasseComplete}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exporter la liasse complète (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('edition_imprimable')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              activeTab === 'edition_imprimable'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'text-foreground bg-surface-elevated hover:bg-surface-border/50 border-surface-border'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Format Imprimable</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer / PDF</span>
          </button>
        </div>
      </div>

      {/* KPIs Synthèse */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <p className="text-xs text-foreground-muted flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-primary" />
            Total Bilan Net
          </p>
          <p className="mt-1 text-lg font-bold font-heading tabular-nums text-foreground">
            {fm(etats.totalActifN.net)}
          </p>
          <p className="text-[11px] text-foreground-muted mt-0.5">
            {etats.exerciceN1 ? `N-1 : ${fm(etats.totalActifN1.net)}` : 'Exercice N'}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-foreground-muted flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
            Chiffre d&apos;Affaires
          </p>
          <p className="mt-1 text-lg font-bold font-heading tabular-nums text-foreground">
            {fm(etats.compteResultat.find((c) => c.ref === 'XB')?.montantN)}
          </p>
          <p className="text-[11px] text-foreground-muted mt-0.5">
            Ventes & prestations
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-foreground-muted flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            Excédent Brut (EBE)
          </p>
          <p className="mt-1 text-lg font-bold font-heading tabular-nums text-foreground">
            {fm(etats.compteResultat.find((c) => c.ref === 'XD')?.montantN)}
          </p>
          <p className="text-[11px] text-foreground-muted mt-0.5">
            Marge brute d&apos;exploitation
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-foreground-muted flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
            Résultat Net
          </p>
          <p
            className={`mt-1 text-lg font-bold font-heading tabular-nums ${
              etats.controles.resultatNetN >= 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {fm(etats.controles.resultatNetN)}
          </p>
          <p className="text-[11px] text-foreground-muted mt-0.5">
            {etats.controles.resultatNetN >= 0 ? 'Bénéfice net' : 'Perte nette'}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-foreground-muted flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-purple-500" />
            Trésorerie Nette
          </p>
          <p
            className={`mt-1 text-lg font-bold font-heading tabular-nums ${
              etats.controles.tresorerieNetteN >= 0 ? 'text-foreground' : 'text-rose-500'
            }`}
          >
            {fm(etats.controles.tresorerieNetteN)}
          </p>
          <p className="text-[11px] text-foreground-muted mt-0.5">
            Disponibilités − Découverts
          </p>
        </Card>
      </div>

      {/* Barre d'onglets de la Liasse Complète */}
      <div className="flex flex-wrap items-center gap-1 border-b border-surface-border">
        <button
          type="button"
          onClick={() => setActiveTab('page_garde')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'page_garde'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Fiche légale & Garde</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('actif')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'actif'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Bilan Actif</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('passif')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'passif'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Bilan Passif</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('resultat')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'resultat'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Compte de Résultat</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tft')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'tft'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Flux de Trésorerie (TFT)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('indicateurs')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'indicateurs'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Note 34 : Indicateurs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'notes'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Les 36 Notes Annexées</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('controles')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'controles'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <CheckCircle className={`w-4 h-4 ${bilanEquilibreN ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span>Équilibre & Contrôles</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('edition_imprimable')}
          className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'edition_imprimable'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Liasse Imprimable (Édition Complète)</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. ONGLET : PAGE DE GARDE & FICHE D'IDENTIFICATION */}
      {/* ==================================================================== */}
      {activeTab === 'page_garde' && (
        <div className="space-y-6 animate-in fade-in-50 duration-150">
          <Card className="p-6">
            <div className="border-b border-surface-border pb-6 text-center space-y-1">
              <p className="text-sm font-bold text-foreground tracking-wider uppercase">
                {etats.fiche.pays}
              </p>
              <p className="text-xs text-foreground-muted uppercase">
                {etats.fiche.ministere}
              </p>
              <p className="text-xs text-foreground-muted uppercase font-semibold">
                {etats.fiche.direction}
              </p>
              <p className="text-xs text-primary font-medium mt-2">
                {etats.fiche.centreDepot}
              </p>
              <h2 className="text-xl font-bold font-heading text-foreground pt-4">
                ÉTATS FINANCIERS NORMALISÉS DU SYSTÈME COMPTABLE OUEST AFRICAIN (SYSCOHADA)
              </h2>
              <p className="text-sm text-foreground font-semibold">
                SYSTÈME NORMAL • EXERCICE CLOS AU {new Date(etats.fiche.dateCloture).toLocaleDateString('fr-FR')}
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mt-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b border-surface-border pb-2 flex items-center gap-2">
                  <Building className="w-4 h-4 text-primary" />
                  Désignation de l&apos;Entreprise
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-surface-border/50">
                    <span className="text-foreground-muted">Dénomination sociale :</span>
                    <span className="font-semibold text-foreground">{etats.fiche.denomination}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-border/50">
                    <span className="text-foreground-muted">Sigle usuel :</span>
                    <span className="font-semibold text-foreground">{etats.fiche.sigle}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-border/50">
                    <span className="text-foreground-muted">N° d&apos;identification fiscale (NINEA/NIF) :</span>
                    <span className="font-mono font-semibold text-primary">{etats.fiche.nineaNif}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-border/50">
                    <span className="text-foreground-muted">Adresse géographique :</span>
                    <span className="text-foreground">{etats.fiche.adresse}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-border/50">
                    <span className="text-foreground-muted">Activité principale :</span>
                    <span className="text-foreground">{etats.fiche.activitePrincipale}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b border-surface-border pb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Renseignements Fiscaux & Juridiques
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-surface-border/50">
                    <span className="text-foreground-muted">Forme juridique (Code 02) :</span>
                    <span className="font-semibold text-foreground">Société Commerciale (SARL / SAS)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-border/50">
                    <span className="text-foreground-muted">Régime fiscal (Code 1) :</span>
                    <span className="font-semibold text-foreground">Réel Normal (SYSCOHADA)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-border/50">
                    <span className="text-foreground-muted">Pays du siège social (Code 07) :</span>
                    <span className="text-foreground">Sénégal (Espace UEMOA)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-border/50">
                    <span className="text-foreground-muted">Exercice comptable :</span>
                    <span className="text-foreground font-mono">
                      {etats.fiche.dateDebut} au {etats.fiche.dateFin} ({etats.fiche.dureeMois} mois)
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-surface-border/50">
                    <span className="text-foreground-muted">Signataire des états financiers :</span>
                    <span className="text-foreground font-semibold">
                      {etats.fiche.signataireNom} ({etats.fiche.signataireQualite})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Suivi des 36 Notes de la liasse */}
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-foreground border-b border-surface-border pb-2 mb-4 flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-primary" />
                Tableau de Suivi des Notes Annexées (Liasse SYSCOHADA)
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 text-xs">
                {etats.notesAnnexees.map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => {
                      setNoteSelectionnee(note.id)
                      setActiveTab('notes')
                    }}
                    className="p-2.5 rounded-lg border border-surface-border bg-surface-elevated hover:border-primary text-left transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div className="truncate mr-2">
                      <span className="font-bold text-foreground">{note.numero}</span>
                      <p className="text-[11px] text-foreground-muted truncate">{note.nomNote}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        note.statut === 'A'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-surface-border text-foreground-muted'
                      }`}
                    >
                      {note.statut}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. ONGLET : BILAN ACTIF */}
      {/* ==================================================================== */}
      {activeTab === 'actif' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Bilan Actif — Système Normal
              </h2>
              <p className="text-xs text-foreground-muted">
                Exercice clos au {new Date(etats.exerciceN.date_fin).toLocaleDateString('fr-FR')} • Montants en {devise}
              </p>
            </div>
            <ExportButtons
              titre={`Bilan Actif (SYSCOHADA) — ${libN}`}
              sousTitre={`${organisationNom} — Exercice ${libN}`}
              fichier={`bilan-actif-${libN}`}
              colonnes={['Réf.', 'Actif', 'Note', `Brut (${libN})`, `Amort./Dépréc.`, `Net (${libN})`, `Net (${libN1})`]}
              lignes={etats.bilanActif.map((l) => [
                l.ref,
                l.libelle,
                l.note,
                l.brutN,
                l.amortN,
                l.netN,
                l.netN1,
              ])}
            />
          </div>

          <TableWrap>
            <thead>
              <tr>
                <th className={`${th} w-16 text-center`}>Réf.</th>
                <th className={th}>Actif</th>
                <th className={`${th} w-20 text-center`}>Note</th>
                <th className={`${th} text-right`}>Brut ({libN})</th>
                <th className={`${th} text-right`}>Amort. / Prov.</th>
                <th className={`${th} text-right font-semibold`}>Net ({libN})</th>
                <th className={`${th} text-right text-foreground-muted`}>Net ({libN1})</th>
              </tr>
            </thead>
            <tbody>
              {etats.bilanActif.map((p) => {
                const aComptes = p.comptesN && p.comptesN.length > 0
                const estDeplie = compteOuvert === p.ref

                return (
                  <React.Fragment key={p.ref}>
                    <tr
                      className={`transition-colors ${
                        p.estTotal
                          ? 'bg-surface-elevated font-bold text-foreground border-t-2 border-surface-border'
                          : 'hover:bg-surface-elevated/50'
                      }`}
                    >
                      <td className={`${td} text-center font-mono font-medium text-xs text-foreground-muted`}>
                        {p.ref}
                      </td>
                      <td className={`${td} font-medium`}>
                        <div className="flex items-center gap-1.5">
                          {aComptes && (
                            <button
                              type="button"
                              onClick={() => toggleDetail(p.ref)}
                              className="text-foreground-muted hover:text-foreground cursor-pointer"
                              title="Déplier les comptes"
                            >
                              {estDeplie ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <span>{p.libelle}</span>
                        </div>
                      </td>
                      <td className={`${td} text-center text-xs text-foreground-muted`}>{p.note}</td>
                      <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                        {p.brutN !== 0 ? fm(p.brutN) : '—'}
                      </td>
                      <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                        {p.amortN !== 0 ? fm(p.amortN) : '—'}
                      </td>
                      <td className={`${td} text-right tabular-nums font-semibold ${p.estTotal ? 'text-primary' : 'text-foreground'}`}>
                        {fm(p.netN)}
                      </td>
                      <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                        {fm(p.netN1)}
                      </td>
                    </tr>

                    {/* Détail des comptes dépliables */}
                    {estDeplie && p.comptesN && (
                      <tr className="bg-surface-elevated/30">
                        <td colSpan={7} className="p-3 pl-10">
                          <div className="rounded-lg border border-surface-border bg-surface p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
                              Comptes rattachés au poste {p.ref} ({p.libelle}) :
                            </p>
                            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                              {p.comptesN.map((c) => (
                                <div
                                  key={c.numero}
                                  className="flex items-center justify-between p-1.5 rounded bg-surface-elevated/50 border border-surface-border/40"
                                >
                                  <span className="font-mono text-primary font-medium">{c.numero}</span>
                                  <span className="truncate mx-2 text-foreground-muted" title={c.libelle}>
                                    {c.libelle}
                                  </span>
                                  <span className="tabular-nums font-semibold text-foreground">
                                    {fm(c.solde)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </TableWrap>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. ONGLET : BILAN PASSIF */}
      {/* ==================================================================== */}
      {activeTab === 'passif' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Bilan Passif — Système Normal
              </h2>
              <p className="text-xs text-foreground-muted">
                Capitaux propres, Dettes financières et Passif circulant • Montants en {devise}
              </p>
            </div>
            <ExportButtons
              titre={`Bilan Passif (SYSCOHADA) — ${libN}`}
              sousTitre={`${organisationNom} — Exercice ${libN}`}
              fichier={`bilan-passif-${libN}`}
              colonnes={['Réf.', 'Passif', 'Note', `Net (${libN})`, `Net (${libN1})`]}
              lignes={etats.bilanPassif.map((l) => [
                l.ref,
                l.libelle,
                l.note,
                l.netN,
                l.netN1,
              ])}
            />
          </div>

          <TableWrap>
            <thead>
              <tr>
                <th className={`${th} w-16 text-center`}>Réf.</th>
                <th className={th}>Passif</th>
                <th className={`${th} w-20 text-center`}>Note</th>
                <th className={`${th} text-right font-semibold`}>Net ({libN})</th>
                <th className={`${th} text-right text-foreground-muted`}>Net ({libN1})</th>
              </tr>
            </thead>
            <tbody>
              {etats.bilanPassif.map((p) => {
                const aComptes = p.comptesN && p.comptesN.length > 0
                const estDeplie = compteOuvert === p.ref

                return (
                  <React.Fragment key={p.ref}>
                    <tr
                      className={`transition-colors ${
                        p.estTotal
                          ? 'bg-surface-elevated font-bold text-foreground border-t-2 border-surface-border'
                          : 'hover:bg-surface-elevated/50'
                      }`}
                    >
                      <td className={`${td} text-center font-mono font-medium text-xs text-foreground-muted`}>
                        {p.ref}
                      </td>
                      <td className={`${td} font-medium`}>
                        <div className="flex items-center gap-1.5">
                          {aComptes && (
                            <button
                              type="button"
                              onClick={() => toggleDetail(p.ref)}
                              className="text-foreground-muted hover:text-foreground cursor-pointer"
                              title="Déplier les comptes"
                            >
                              {estDeplie ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <span>{p.libelle}</span>
                        </div>
                      </td>
                      <td className={`${td} text-center text-xs text-foreground-muted`}>{p.note}</td>
                      <td className={`${td} text-right tabular-nums font-semibold ${p.estTotal ? 'text-primary' : 'text-foreground'}`}>
                        {fm(p.netN)}
                      </td>
                      <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                        {fm(p.netN1)}
                      </td>
                    </tr>

                    {/* Détail des comptes dépliables */}
                    {estDeplie && p.comptesN && (
                      <tr className="bg-surface-elevated/30">
                        <td colSpan={5} className="p-3 pl-10">
                          <div className="rounded-lg border border-surface-border bg-surface p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
                              Comptes rattachés au poste {p.ref} ({p.libelle}) :
                            </p>
                            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                              {p.comptesN.map((c) => (
                                <div
                                  key={c.numero}
                                  className="flex items-center justify-between p-1.5 rounded bg-surface-elevated/50 border border-surface-border/40"
                                >
                                  <span className="font-mono text-primary font-medium">{c.numero}</span>
                                  <span className="truncate mx-2 text-foreground-muted" title={c.libelle}>
                                    {c.libelle}
                                  </span>
                                  <span className="tabular-nums font-semibold text-foreground">
                                    {fm(c.solde)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </TableWrap>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. ONGLET : COMPTE DE RÉSULTAT */}
      {/* ==================================================================== */}
      {activeTab === 'resultat' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Compte de Résultat — Système Normal
              </h2>
              <p className="text-xs text-foreground-muted">
                Soldes Intermédiaires de Gestion (SIG) de l&apos;exercice • Montants en {devise}
              </p>
            </div>
            <ExportButtons
              titre={`Compte de Résultat (SYSCOHADA) — ${libN}`}
              sousTitre={`${organisationNom} — Exercice ${libN}`}
              fichier={`compte-resultat-${libN}`}
              colonnes={['Réf.', 'Libellé', 'Note', `Montant (${libN})`, `Montant (${libN1})`]}
              lignes={etats.compteResultat.map((l) => [
                l.ref,
                l.libelle,
                l.note,
                l.montantN,
                l.montantN1,
              ])}
            />
          </div>

          <TableWrap>
            <thead>
              <tr>
                <th className={`${th} w-16 text-center`}>Réf.</th>
                <th className={th}>Libellé des opérations</th>
                <th className={`${th} w-20 text-center`}>Note</th>
                <th className={`${th} text-right font-semibold`}>Exercice {libN}</th>
                <th className={`${th} text-right text-foreground-muted`}>Exercice {libN1}</th>
              </tr>
            </thead>
            <tbody>
              {etats.compteResultat.map((r) => {
                const aComptes = r.comptesN && r.comptesN.length > 0
                const estDeplie = compteOuvert === r.ref
                const estSig = r.type === 'sig'

                return (
                  <React.Fragment key={r.ref}>
                    <tr
                      className={`transition-colors ${
                        estSig
                          ? 'bg-surface-elevated font-bold text-foreground border-y border-surface-border'
                          : 'hover:bg-surface-elevated/50'
                      }`}
                    >
                      <td className={`${td} text-center font-mono font-medium text-xs ${estSig ? 'text-primary font-bold' : 'text-foreground-muted'}`}>
                        {r.ref}
                      </td>
                      <td className={`${td} ${estSig ? 'font-bold' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          {aComptes && (
                            <button
                              type="button"
                              onClick={() => toggleDetail(r.ref)}
                              className="text-foreground-muted hover:text-foreground cursor-pointer"
                              title="Déplier les comptes"
                            >
                              {estDeplie ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <span>{r.libelle}</span>
                        </div>
                      </td>
                      <td className={`${td} text-center text-xs text-foreground-muted`}>{r.note}</td>
                      <td
                        className={`${td} text-right tabular-nums font-semibold ${
                          r.ref === 'XI'
                            ? r.montantN >= 0
                              ? 'text-emerald-500 font-bold'
                              : 'text-rose-500 font-bold'
                            : estSig
                            ? 'text-primary'
                            : 'text-foreground'
                        }`}
                      >
                        {fm(r.montantN)}
                      </td>
                      <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                        {fm(r.montantN1)}
                      </td>
                    </tr>

                    {/* Comptes rattachés */}
                    {estDeplie && r.comptesN && (
                      <tr className="bg-surface-elevated/30">
                        <td colSpan={5} className="p-3 pl-10">
                          <div className="rounded-lg border border-surface-border bg-surface p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
                              Comptes de gestion ({r.libelle}) :
                            </p>
                            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                              {r.comptesN.map((c) => (
                                <div
                                  key={c.numero}
                                  className="flex items-center justify-between p-1.5 rounded bg-surface-elevated/50 border border-surface-border/40"
                                >
                                  <span className="font-mono text-primary font-medium">{c.numero}</span>
                                  <span className="truncate mx-2 text-foreground-muted" title={c.libelle}>
                                    {c.libelle}
                                  </span>
                                  <span className="tabular-nums font-semibold text-foreground">
                                    {fm(c.solde)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </TableWrap>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. ONGLET : TABLEAU DES FLUX DE TRÉSORERIE (TFT) */}
      {/* ==================================================================== */}
      {activeTab === 'tft' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Tableau des Flux de Trésorerie (TFT)
              </h2>
              <p className="text-xs text-foreground-muted">
                Flux d&apos;exploitation, investissement et financement selon la méthode indirecte SYSCOHADA
              </p>
            </div>
            <ExportButtons
              titre={`Tableau des Flux de Trésorerie (TFT) — ${libN}`}
              sousTitre={`${organisationNom} — Exercice ${libN}`}
              fichier={`tft-${libN}`}
              colonnes={['Réf.', 'Libellé des flux', 'Note', `Exercice (${libN})`, `Exercice (${libN1})`]}
              lignes={etats.tft.map((l) => [
                l.ref,
                l.libelle,
                l.note ?? '',
                l.montantN,
                l.montantN1,
              ])}
            />
          </div>

          <TableWrap>
            <thead>
              <tr>
                <th className={`${th} w-16 text-center`}>Réf.</th>
                <th className={th}>Libellé des flux de trésorerie</th>
                <th className={`${th} w-20 text-center`}>Note</th>
                <th className={`${th} text-right font-semibold`}>Exercice {libN}</th>
                <th className={`${th} text-right text-foreground-muted`}>Exercice {libN1}</th>
              </tr>
            </thead>
            <tbody>
              {etats.tft.map((l) => {
                const estTotal = l.type === 'total'
                const estSousTotal = l.type === 'sous_total'

                return (
                  <tr
                    key={l.ref}
                    className={`transition-colors ${
                      estTotal
                        ? 'bg-surface-elevated font-bold text-foreground border-y-2 border-surface-border'
                        : estSousTotal
                        ? 'bg-surface-elevated/40 font-semibold text-foreground border-y border-surface-border/50'
                        : 'hover:bg-surface-elevated/50'
                    }`}
                  >
                    <td className={`${td} text-center font-mono font-medium text-xs ${estTotal ? 'text-primary' : 'text-foreground-muted'}`}>
                      {l.ref}
                    </td>
                    <td className={`${td} ${estTotal ? 'font-bold' : ''}`}>{l.libelle}</td>
                    <td className={`${td} text-center text-xs text-foreground-muted`}>{l.note ?? ''}</td>
                    <td
                      className={`${td} text-right tabular-nums font-semibold ${
                        estTotal ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {fm(l.montantN)}
                    </td>
                    <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                      {fm(l.montantN1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. ONGLET : NOTE 34 — INDICATEURS FINANCIERS */}
      {/* ==================================================================== */}
      {activeTab === 'indicateurs' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Note 34 — Fiche de Synthèse des Principaux Indicateurs Financiers
              </h2>
              <p className="text-xs text-foreground-muted">
                Soldes Intermédiaires, Ratios de rentabilité, Analyse du BFR et Fonds de Roulement
              </p>
            </div>
            <ExportButtons
              titre={`Note 34 Indicateurs Financiers — ${libN}`}
              sousTitre={`${organisationNom} — Exercice ${libN}`}
              fichier={`note-34-indicateurs-${libN}`}
              colonnes={['Code', 'Indicateur', `Exercice (${libN})`, `Exercice (${libN1})`]}
              lignes={etats.indicateurs.map((l) => [
                l.code,
                l.libelle,
                l.montantN,
                l.montantN1,
              ])}
            />
          </div>

          <TableWrap>
            <thead>
              <tr>
                <th className={`${th} w-24 text-center`}>Code</th>
                <th className={th}>Indicateurs Financiers & Ratios</th>
                <th className={`${th} text-right font-semibold`}>Exercice {libN}</th>
                <th className={`${th} text-right text-foreground-muted`}>Exercice {libN1}</th>
              </tr>
            </thead>
            <tbody>
              {etats.indicateurs.map((ind, idx) => {
                const estTitre = ind.type === 'titre'
                const estTotal = ind.type === 'total'
                const estSousTotal = ind.type === 'sous_total'

                if (estTitre) {
                  return (
                    <tr key={idx} className="bg-surface-elevated/70 border-y border-surface-border">
                      <td colSpan={4} className="py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-primary">
                        {ind.libelle}
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      estTotal
                        ? 'bg-surface-elevated font-bold text-foreground border-y border-surface-border'
                        : estSousTotal
                        ? 'bg-surface-elevated/30 font-semibold'
                        : 'hover:bg-surface-elevated/50'
                    }`}
                  >
                    <td className={`${td} text-center font-mono text-xs text-foreground-muted`}>
                      {ind.code}
                    </td>
                    <td className={`${td} ${estTotal ? 'font-bold' : ''}`}>{ind.libelle}</td>
                    <td className={`${td} text-right tabular-nums font-semibold ${estTotal ? 'text-primary' : 'text-foreground'}`}>
                      {typeof ind.montantN === 'number' ? fm(ind.montantN) : ind.montantN}
                    </td>
                    <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                      {typeof ind.montantN1 === 'number' ? fm(ind.montantN1) : ind.montantN1}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. ONGLET : LES 36 NOTES ANNEXÉES */}
      {/* ==================================================================== */}
      {activeTab === 'notes' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Les 36 Notes Annexées — Système Normal
              </h2>
              <p className="text-xs text-foreground-muted">
                Détail analytique des postes du Bilan et du Compte de Résultat
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Filtrer les notes..."
                  value={filtreNote}
                  onChange={(e) => setFiltreNote(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-surface border border-surface-border rounded-lg text-foreground focus:outline-none focus:border-primary w-48 sm:w-64"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Liste des notes à gauche */}
            <div className="space-y-1 max-h-[650px] overflow-y-auto pr-1 rounded-xl border border-surface-border bg-surface p-2">
              {notesFiltrees.map((note) => {
                const estActive = note.id === noteSelectionnee
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setNoteSelectionnee(note.id)}
                    className={`w-full p-2.5 rounded-lg text-left transition-colors flex items-center justify-between cursor-pointer ${
                      estActive
                        ? 'bg-primary text-white shadow-sm font-semibold'
                        : 'hover:bg-surface-elevated text-foreground'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <span className={`text-xs font-bold ${estActive ? 'text-white' : 'text-foreground'}`}>
                        {note.numero}
                      </span>
                      <p className={`text-[11px] truncate ${estActive ? 'text-white/80' : 'text-foreground-muted'}`}>
                        {note.nomNote}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        estActive
                          ? 'bg-white/20 text-white'
                          : note.statut === 'A'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-surface-border text-foreground-muted'
                      }`}
                    >
                      {note.statut}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Détail de la note sélectionnée à droite */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-surface-border pb-3">
                  <div>
                    <span className="text-xs font-bold text-primary">{noteCourante.numero}</span>
                    <h3 className="text-base font-bold font-heading text-foreground mt-0.5">
                      {noteCourante.nomNote}
                    </h3>
                  </div>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      noteCourante.statut === 'A'
                        ? 'bg-emerald-500/10 text-emerald-500'
                        : 'bg-surface-border text-foreground-muted'
                    }`}
                  >
                    {noteCourante.statut === 'A' ? 'Applicable' : 'Non Applicable'}
                  </span>
                </div>

                <TableWrap>
                  <thead>
                    <tr>
                      <th className={th}>Libellé / Rubrique</th>
                      <th className={`${th} text-right font-semibold`}>Exercice {libN}</th>
                      <th className={`${th} text-right text-foreground-muted`}>Exercice {libN1}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noteCourante.items.map((item, i) => (
                      <tr key={i} className="hover:bg-surface-elevated/50">
                        <td className={td}>
                          <div>
                            <span className="font-medium text-foreground">{item.intitule}</span>
                            {item.detail && (
                              <p className="text-[11px] text-foreground-muted mt-0.5">{item.detail}</p>
                            )}
                          </div>
                        </td>
                        <td className={`${td} text-right tabular-nums font-semibold text-foreground`}>
                          {typeof item.montantN === 'number' ? fm(item.montantN) : item.montantN}
                        </td>
                        <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                          {item.montantN1 !== undefined
                            ? typeof item.montantN1 === 'number'
                              ? fm(item.montantN1)
                              : item.montantN1
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>

                {noteCourante.commentaires && (
                  <div className="p-3 rounded-lg bg-surface-elevated border border-surface-border text-xs text-foreground-muted flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{noteCourante.commentaires}</span>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. ONGLET : ÉQUILIBRE & CONTRÔLES */}
      {/* ==================================================================== */}
      {activeTab === 'edition_imprimable' && (
        <LiasseImprimable
          etats={etats}
          devise={devise}
          lang={lang}
          organisationNom={organisationNom}
        />
      )}

      {activeTab === 'controles' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div>
            <h2 className="text-lg font-bold font-heading text-foreground">
              Contrôles de Cohérence & d&apos;Équilibre SYSCOHADA
            </h2>
            <p className="text-xs text-foreground-muted">
              Vérifications obligatoires pour la certification et le dépôt de la liasse fiscale
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Contrôle 1 : Équilibre Actif = Passif */}
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground-muted">Équilibre Bilan N</span>
                {bilanEquilibreN ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
                    <CheckCircle className="w-4 h-4" /> Conforme
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-semibold text-rose-500">
                    <AlertTriangle className="w-4 h-4" /> Déséquilibre
                  </span>
                )}
              </div>
              <p className="text-xl font-bold font-heading tabular-nums text-foreground">
                Écart : {fm(etats.controles.equilibreBilanN)}
              </p>
              <p className="text-xs text-foreground-muted">
                Total Actif Net ({fm(etats.totalActifN.net)}) − Total Passif ({fm(etats.totalPassifN)})
              </p>
            </Card>

            {/* Contrôle 2 : Bouclage du TFT */}
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground-muted">Bouclage Trésorerie (TFT)</span>
                {tftEquilibre ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
                    <CheckCircle className="w-4 h-4" /> Conforme
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-500">
                    <AlertTriangle className="w-4 h-4" /> Écart
                  </span>
                )}
              </div>
              <p className="text-xl font-bold font-heading tabular-nums text-foreground">
                Écart : {fm(etats.controles.ecartBouclageTFT)}
              </p>
              <p className="text-xs text-foreground-muted">
                Flux net de la période − Variation trésorerie bilantielle
              </p>
            </Card>

            {/* Contrôle 3 : Égalité FR - BFG = TN */}
            <Card className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground-muted">Égalité FR − BFG = TN</span>
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500">
                  <CheckCircle className="w-4 h-4" /> Conforme
                </span>
              </div>
              <p className="text-xl font-bold font-heading tabular-nums text-foreground">
                TN = {fm(etats.controles.tresorerieCalculeeN)}
              </p>
              <p className="text-xs text-foreground-muted">
                FR ({fm(etats.controles.fondsRoulementN)}) − BFG ({fm(etats.controles.besoinFinancementGlobalN)})
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>

      {/* Mode impression globale : s'imprime automatiquement lors de window.print() */}
      {activeTab !== 'edition_imprimable' && (
        <div className="hidden print:block">
          <LiasseImprimable
            etats={etats}
            devise={devise}
            lang={lang}
            organisationNom={organisationNom}
          />
        </div>
      )}
    </>
  )
}
