'use client'

import React, { useState, useEffect } from 'react'
import {
  Printer,
  Download,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import type { Lang } from '@/lib/i18n'
import {
  type EtatsFinanciersSyscohada,
  type NoteAnnexe,
  exporterLiasseCompleteCSV,
} from '@/lib/syscohada'

export default function LiasseImprimable({
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
  const fm = (val: number | string | undefined | null) => {
    if (val === null || val === undefined || val === '') return '-'
    const n = Number(val)
    if (isNaN(n)) return String(val)
    if (n === 0) return '0'
    return Math.round(n).toLocaleString('fr-FR')
  }

  const libN = etats.exerciceN.libelle
  const libN1 = etats.exerciceN1?.libelle ?? 'N-1'

  const [dateEdition, setDateEdition] = useState<string>('')
  const [urlEdition, setUrlEdition] = useState<string>('')

  // 1. Possibilité à l'entreprise de préciser les notes Applicables (A) ou Non (N/A)
  const [notesStatut, setNotesStatut] = useState<Record<string, 'A' | 'N/A'>>(() => {
    const init: Record<string, 'A' | 'N/A'> = {}
    etats.notesAnnexees.forEach((n) => {
      init[n.id] = n.statut
    })
    return init
  })

  // 2. Possibilité d'imprimer ou pas les pages non chiffrées
  const [masquerNonChiffrees, setMasquerNonChiffrees] = useState<boolean>(true)

  const [afficherConfigNotes, setAfficherConfigNotes] = useState<boolean>(false)

  useEffect(() => {
    const now = new Date()
    setDateEdition(
      now.toLocaleDateString('fr-FR') +
        ' à ' +
        now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    )
    if (typeof window !== 'undefined') {
      setUrlEdition(window.location.href.split('?')[0])
    }
  }, [])

  const toggleStatutNote = (id: string) => {
    setNotesStatut((prev) => ({
      ...prev,
      [id]: prev[id] === 'A' ? 'N/A' : 'A',
    }))
  }

  const appliquerToutesA = () => {
    const maj: Record<string, 'A' | 'N/A'> = {}
    etats.notesAnnexees.forEach((n) => {
      maj[n.id] = 'A'
    })
    setNotesStatut(maj)
  }

  const appliquerToutesNA = () => {
    const maj: Record<string, 'A' | 'N/A'> = {}
    etats.notesAnnexees.forEach((n) => {
      if (['note-1', 'note-2', 'note-34'].includes(n.id)) {
        maj[n.id] = 'A'
      } else {
        maj[n.id] = 'N/A'
      }
    })
    setNotesStatut(maj)
  }

  const detectionAutomatique = () => {
    const maj: Record<string, 'A' | 'N/A'> = {}
    etats.notesAnnexees.forEach((n) => {
      maj[n.id] = n.statut
    })
    setNotesStatut(maj)
  }

  const telechargerCSV = () => {
    const csvContent = exporterLiasseCompleteCSV(etats, notesStatut)
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

  // Vérifie si une note contient des chiffres significatifs
  const noteEstChiffree = (note: NoteAnnexe): boolean => {
    // Les notes textuelles réglementaires ou synthétiques sont toujours considérées chiffrées
    if (['note-1', 'note-2', 'note-34', 'note-35', 'note-36'].includes(note.id)) {
      return true
    }
    return note.items.some((it) => {
      const n = typeof it.montantN === 'number' ? it.montantN : Number(it.montantN) || 0
      const n1 = typeof it.montantN1 === 'number' ? it.montantN1 : Number(it.montantN1) || 0
      const a = typeof it.colA === 'number' ? it.colA : Number(it.colA) || 0
      const b = typeof it.colB === 'number' ? it.colB : Number(it.colB) || 0
      const c = typeof it.colC === 'number' ? it.colC : Number(it.colC) || 0
      const d = typeof it.colD === 'number' ? it.colD : Number(it.colD) || 0
      return n !== 0 || n1 !== 0 || a !== 0 || b !== 0 || c !== 0 || d !== 0
    })
  }

  // Filtrage des notes pour le détail imprimable :
  // 1. Statut = A
  // 2. Si masquerNonChiffrees est coché : la note doit avoir des montants > 0
  const notesAImprimer = etats.notesAnnexees.filter((n) => {
    if (notesStatut[n.id] !== 'A') return false
    if (masquerNonChiffrees && !noteEstChiffree(n)) return false
    return true
  })

  const totalNotesA = etats.notesAnnexees.filter((n) => notesStatut[n.id] === 'A').length
  const totalNotesImprimees = notesAImprimer.length

  return (
    <div className="space-y-6">
      {/* Styles d'impression A4 */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm 8mm 6mm 8mm;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            font-size: 9px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-break-page {
            break-after: page !important;
            page-break-after: always !important;
          }
          .print-avoid-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          .print-cdr-table tr {
            height: 4.8mm !important;
          }
        }
      `}</style>

      {/* ================================================================== */}
      {/* BARRE D'ACTIONS & CONFIGURATION DES NOTES (MASQUÉE À L'IMPRESSION) */}
      {/* ================================================================== */}
      <div className="print:hidden space-y-4 bg-surface p-4 rounded-xl border border-surface-border shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Printer className="w-4 h-4 text-primary" />
              Édition Officielle de la Liasse Financière (Format Imprimable & PDF)
            </h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              Conforme au modèle officiel DGID SYSCOHADA (Système Normal) • {totalNotesA} / 36 notes déclarées (A) • {totalNotesImprimees} notes éditées
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={telechargerCSV}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger la Liasse (CSV Normalisé)</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / Exporter en PDF</span>
            </button>
          </div>
        </div>

        {/* Options d'impression et personnalisation A / N/A */}
        <div className="border-t border-surface-border pt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-elevated/40 p-2.5 rounded-lg border border-surface-border">
            {/* Option : Imprimer ou pas les pages non chiffrées */}
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={masquerNonChiffrees}
                onChange={(e) => setMasquerNonChiffrees(e.target.checked)}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <span>Masquer à l&apos;impression les notes non chiffrées (tableaux à zéro / néant)</span>
            </label>

            {/* Actions rapides sur les notes */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={detectionAutomatique}
                className="px-2.5 py-1 text-[11px] font-medium rounded border border-surface-border bg-surface hover:bg-primary/10 transition-colors cursor-pointer"
              >
                Détection automatique
              </button>
              <button
                type="button"
                onClick={appliquerToutesA}
                className="px-2.5 py-1 text-[11px] font-medium rounded border border-surface-border bg-surface hover:bg-primary/10 transition-colors cursor-pointer"
              >
                Toutes Applicables (A)
              </button>
              <button
                type="button"
                onClick={appliquerToutesNA}
                className="px-2.5 py-1 text-[11px] font-medium rounded border border-surface-border bg-surface hover:bg-primary/10 transition-colors cursor-pointer"
              >
                Toutes N/A
              </button>
              <button
                type="button"
                onClick={() => setAfficherConfigNotes((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-primary rounded border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Préciser note par note</span>
                {afficherConfigNotes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {afficherConfigNotes && (
            <div className="p-3 bg-surface-elevated/60 rounded-lg border border-surface-border">
              <p className="text-[11px] text-foreground-muted mb-2">
                Basculez chaque note entre <strong>(A) Applicable</strong> et <strong>(N/A) Non Applicable</strong>. Toutes les notes figurent sur le tableau récapitulatif FR4 de la page 2, et seules les notes applicables{masquerNonChiffrees ? ' chiffrées' : ''} sont détaillées ci-après.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {etats.notesAnnexees.map((n) => {
                  const estA = notesStatut[n.id] === 'A'
                  const chifree = noteEstChiffree(n)
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => toggleStatutNote(n.id)}
                      className={`px-2 py-1 text-[10px] rounded font-semibold text-left truncate flex items-center justify-between border cursor-pointer transition-all ${
                        estA
                          ? 'bg-primary/15 text-primary border-primary/40 shadow-xs'
                          : 'bg-surface text-foreground-muted border-surface-border opacity-70 hover:opacity-100'
                      }`}
                      title={n.nomNote}
                    >
                      <span className="truncate">{n.numero}</span>
                      <div className="flex items-center gap-1">
                        {!chifree && <span className="text-[8px] text-foreground-muted">(0)</span>}
                        <span className={`text-[9px] px-1 rounded ${estA ? 'bg-primary text-white' : 'bg-surface-border text-foreground-muted'}`}>
                          {estA ? 'A' : 'N/A'}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* DOSSIER IMPRIMABLE CONTINU (SANS PAGES VIDES NI DÉBORDEMENTS)     */}
      {/* ================================================================== */}
      <div className="print:m-0 print:p-0 space-y-6 print:space-y-0 text-foreground">

        {/* ------------------------------------------------------------------ */}
        {/* PAGE 1 : PAGE DE GARDE OFFICIELLE & CERTIFICATION DU SIGNATAIRE     */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-6 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page flex flex-col justify-between max-h-[1080px]">
          <div className="space-y-3 text-center">
            {/* Sceau & Ministère */}
            <div className="border-b-2 border-foreground/80 pb-2 space-y-0.5">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">
                {etats.fiche.pays}
              </p>
              <p className="text-[10px] uppercase font-medium text-foreground-muted">
                {etats.fiche.ministere}
              </p>
              <p className="text-[10px] uppercase font-bold text-foreground">
                {etats.fiche.direction}
              </p>
              <p className="text-[10px] font-semibold text-primary">
                {etats.fiche.centreDepot}
              </p>
            </div>

            {/* Titre officiel de la liasse */}
            <div className="py-2 space-y-1">
              <span className="inline-block px-2.5 py-0.5 text-[10px] font-black uppercase rounded bg-primary/10 text-primary border border-primary/20 tracking-wider">
                SYSTÈME NORMAL
              </span>
              <h1 className="text-lg font-black font-heading text-foreground uppercase tracking-wide">
                ÉTATS FINANCIERS NORMALISÉS DU SYSTÈME COMPTABLE OUEST AFRICAIN (SYSCOHADA)
              </h1>
              <p className="text-xs font-bold text-foreground">
                EXERCICE CLOS LE : {new Date(etats.fiche.dateCloture).toLocaleDateString('fr-FR')} • DURÉE : {etats.fiche.dureeMois} MOIS
              </p>
            </div>

            {/* Cadre Désignation Entreprise */}
            <div className="border border-foreground/60 rounded-lg p-3 text-left space-y-2 bg-surface-elevated/30 print:bg-transparent">
              <p className="text-[10px] font-black uppercase tracking-wider text-primary border-b border-foreground/20 pb-0.5">
                DÉSIGNATION DE L&apos;ENTREPRISE
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-foreground-muted block text-[10px]">Dénomination sociale :</span>
                  <span className="font-bold text-foreground">{etats.fiche.denomination}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">Sigle usuel :</span>
                  <span className="font-bold text-foreground">{etats.fiche.sigle}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">N° d&apos;identification fiscale (NINEA) :</span>
                  <span className="font-mono font-bold text-primary">{etats.fiche.nineaNif}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">Période comptable :</span>
                  <span className="font-medium text-foreground">Du {etats.fiche.dateDebut} au {etats.fiche.dateFin}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-foreground-muted block text-[10px]">Adresse géographique complète :</span>
                  <span className="font-medium text-foreground">{etats.fiche.adresse}</span>
                </div>
              </div>
            </div>

            {/* Documents déposés & cadre de réception fiscale */}
            <div className="grid grid-cols-2 gap-4 text-left text-[11px] pt-1">
              <div className="border border-foreground/40 rounded-lg p-3 space-y-1.5">
                <p className="font-bold uppercase text-[10px] text-foreground border-b pb-0.5">Documents Déposés</p>
                <div className="space-y-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-primary">[X]</span>
                    <span>Fiche d&apos;identification & renseignements divers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-primary">[X]</span>
                    <span>Bilan du Système Normal (Actif & Passif)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-primary">[X]</span>
                    <span>Compte de Résultat</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-primary">[X]</span>
                    <span>Tableau des Flux de Trésorerie (TFT)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-primary">[X]</span>
                    <span>Notes Annexées ({totalNotesA} notes applicables déposées)</span>
                  </div>
                </div>
              </div>

              <div className="border border-foreground/40 rounded-lg p-3 space-y-2 flex flex-col justify-between">
                <div>
                  <p className="font-bold uppercase text-[10px] text-foreground border-b pb-0.5">Réservé à l&apos;Administration Fiscale (DGID)</p>
                  <p className="text-[10px] text-foreground-muted mt-1">Date de dépôt : _____________________</p>
                  <p className="text-[10px] text-foreground-muted mt-1">Nom de l&apos;agent : _________________________</p>
                </div>
                <div className="border-t border-dashed pt-1 text-center text-[9px] text-foreground-muted">
                  Signature de l&apos;agent & Cachet du service
                </div>
              </div>
            </div>
          </div>

          {/* SIGNATURE & CERTIFICATION RAMENÉES FERMEMENT À LA 1ÈRE PAGE */}
          <div className="mt-4 pt-3 border-t-2 border-foreground/50 flex justify-between items-end text-xs">
            <div className="space-y-0.5">
              <p className="text-[10px] text-foreground-muted uppercase font-bold tracking-wider">Certification des états financiers :</p>
              <p className="text-foreground-muted text-[11px]">Certifié conforme par :</p>
              <p className="font-bold text-foreground text-sm">{etats.fiche.signataireNom}</p>
              <p className="text-[10px] text-foreground-muted">{etats.fiche.signataireQualite}</p>
              <p className="text-[9px] text-foreground-muted pt-1">
                Date de signature : {new Date(etats.fiche.dateCloture).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">Signature & Cachet de l&apos;Entreprise</p>
              <div className="w-52 h-16 border-2 border-dashed border-foreground/50 rounded flex items-center justify-center text-[9px] text-foreground-muted bg-surface-elevated/20">
                Cadre réservé au cachet officiel
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGE 2 : FICHE D'IDENTIFICATION & RENSEIGNEMENTS DIVERS (ZK À ZP)   */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-6 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page space-y-4">
          <div className="text-center border-b border-foreground/40 pb-2">
            <h2 className="text-sm font-black font-heading uppercase text-foreground">
              FICHE D&apos;IDENTIFICATION ET RENSEIGNEMENTS DIVERS
            </h2>
            <p className="text-[10px] text-foreground-muted">
              {etats.fiche.denomination} • NINEA : {etats.fiche.nineaNif} • Exercice clos au {etats.fiche.dateCloture}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="border border-surface-border p-2.5 rounded-lg space-y-1">
              <p className="font-bold text-primary uppercase text-[10px]">Identification de l&apos;Entité</p>
              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between"><span className="text-foreground-muted">Dénomination :</span><span className="font-semibold">{etats.fiche.denomination}</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Sigle usuel :</span><span className="font-semibold">{etats.fiche.sigle}</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">NINEA :</span><span className="font-mono font-bold text-primary">{etats.fiche.nineaNif}</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Exercice :</span><span>Du {etats.fiche.dateDebut} au {etats.fiche.dateFin}</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Adresse :</span><span className="truncate max-w-[200px]">{etats.fiche.adresse}</span></div>
              </div>
            </div>

            <div className="border border-surface-border p-2.5 rounded-lg space-y-1">
              <p className="font-bold text-primary uppercase text-[10px]">Cadre Réglementaire & Fiscal</p>
              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between"><span className="text-foreground-muted">Forme juridique (ZK) :</span><span className="font-semibold">Code {etats.fiche.formeJuridiqueCode}</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Régime fiscal (ZL) :</span><span className="font-semibold">Code {etats.fiche.regimeFiscalCode} (Réel Normal)</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Pays siège (ZM) :</span><span>Code {etats.fiche.paysSiegeCode} (Sénégal)</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Code activité (ZE) :</span><span className="font-mono font-semibold">{etats.fiche.codeActivite}</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Activité principale :</span><span className="truncate max-w-[200px]">{etats.fiche.activitePrincipale}</span></div>
              </div>
            </div>
          </div>

          {/* TABLEAU RÉCAPITULATIF DES 36 NOTES ANNEXÉES (FR4) EN 2 COLONNES */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                Tableau de Pointage des 36 Notes Annexées (Formulaire FR4 DGID) :
              </p>
              <span className="text-[9px] text-foreground-muted">
                Légende : A = Applicable • N/A = Non Applicable
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[9.5px]">
              {/* Colonne 1 : Notes 1 à 18 */}
              <table className="w-full border border-foreground/30 border-collapse">
                <thead>
                  <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/30 text-center">
                    <th className="p-1 border-r border-foreground/30 w-14">N°</th>
                    <th className="p-1 border-r border-foreground/30 text-left">Intitulé de la Note</th>
                    <th className="p-1 border-r border-foreground/30 w-8">A</th>
                    <th className="p-1 w-8">N/A</th>
                  </tr>
                </thead>
                <tbody>
                  {etats.notesAnnexees.slice(0, 18).map((note) => {
                    const estA = notesStatut[note.id] === 'A'
                    return (
                      <tr key={note.id} className="border-b border-foreground/20 leading-tight">
                        <td className="p-0.5 border-r border-foreground/30 text-center font-bold">{note.numero}</td>
                        <td className="p-0.5 border-r border-foreground/30 truncate max-w-[170px]" title={note.nomNote}>
                          {note.nomNote}
                        </td>
                        <td
                          className={`p-0.5 border-r border-foreground/30 text-center font-bold cursor-pointer print:cursor-default ${
                            estA ? 'bg-primary/20 text-primary print:bg-transparent print:text-black' : ''
                          }`}
                          onClick={() => toggleStatutNote(note.id)}
                        >
                          {estA ? 'X' : ''}
                        </td>
                        <td
                          className={`p-0.5 text-center font-bold text-foreground-muted cursor-pointer print:cursor-default ${
                            !estA ? 'bg-surface-border text-foreground print:bg-transparent print:text-black' : ''
                          }`}
                          onClick={() => toggleStatutNote(note.id)}
                        >
                          {!estA ? 'X' : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Colonne 2 : Notes 19 à 36 */}
              <table className="w-full border border-foreground/30 border-collapse">
                <thead>
                  <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/30 text-center">
                    <th className="p-1 border-r border-foreground/30 w-14">N°</th>
                    <th className="p-1 border-r border-foreground/30 text-left">Intitulé de la Note</th>
                    <th className="p-1 border-r border-foreground/30 w-8">A</th>
                    <th className="p-1 w-8">N/A</th>
                  </tr>
                </thead>
                <tbody>
                  {etats.notesAnnexees.slice(18, 36).map((note) => {
                    const estA = notesStatut[note.id] === 'A'
                    return (
                      <tr key={note.id} className="border-b border-foreground/20 leading-tight">
                        <td className="p-0.5 border-r border-foreground/30 text-center font-bold">{note.numero}</td>
                        <td className="p-0.5 border-r border-foreground/30 truncate max-w-[170px]" title={note.nomNote}>
                          {note.nomNote}
                        </td>
                        <td
                          className={`p-0.5 border-r border-foreground/30 text-center font-bold cursor-pointer print:cursor-default ${
                            estA ? 'bg-primary/20 text-primary print:bg-transparent print:text-black' : ''
                          }`}
                          onClick={() => toggleStatutNote(note.id)}
                        >
                          {estA ? 'X' : ''}
                        </td>
                        <td
                          className={`p-0.5 text-center font-bold text-foreground-muted cursor-pointer print:cursor-default ${
                            !estA ? 'bg-surface-border text-foreground print:bg-transparent print:text-black' : ''
                          }`}
                          onClick={() => toggleStatutNote(note.id)}
                        >
                          {!estA ? 'X' : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGE 3 : BILAN DU SYSTÈME NORMAL — ACTIF                           */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-4 print:p-0 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page print-avoid-break space-y-1">
          <div className="text-center border-b border-foreground/30 pb-1 mb-1 print:pb-0.5 print:mb-0.5 leading-tight">
            <div className="flex justify-between items-center text-[9px] print:text-[8px] text-foreground-muted">
              <span className="font-semibold text-foreground">{etats.fiche.denomination}</span>
              <span>NINEA : {etats.fiche.nineaNif}</span>
            </div>
            <h2 className="text-xs print:text-[10px] font-black font-heading uppercase text-foreground">
              BILAN DU SYSTÈME NORMAL — ACTIF
            </h2>
            <p className="text-[9px] print:text-[7.5px] text-foreground-muted">
              Exercice clos au {etats.fiche.dateCloture} • Durée : {etats.fiche.dureeMois} mois
            </p>
          </div>

          <table className="w-full text-[9px] print:text-[7.5px] border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 border-r border-foreground/30 w-8">Réf.</th>
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 border-r border-foreground/30 text-left">ACTIF</th>
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 border-r border-foreground/30 w-10">Note</th>
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 border-r border-foreground/30 text-right w-24">Brut ({libN})</th>
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 border-r border-foreground/30 text-right w-24">Amort./Prov.</th>
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 border-r border-foreground/30 text-right w-24 font-bold">Net ({libN})</th>
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 text-right w-24 text-foreground-muted">Net ({libN1})</th>
              </tr>
            </thead>
            <tbody>
              {etats.bilanActif.map((a) => (
                <tr
                  key={a.ref}
                  className={`border-b border-foreground/20 leading-tight ${
                    a.estTotal ? 'font-bold bg-surface-elevated/40 print:bg-gray-100' : ''
                  }`}
                >
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-center font-mono">{a.ref}</td>
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30">{a.libelle}</td>
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-center text-foreground-muted">{a.note}</td>
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-right tabular-nums">{a.brutN !== 0 ? fm(a.brutN) : '—'}</td>
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-right tabular-nums">{a.amortN !== 0 ? fm(a.amortN) : '—'}</td>
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(a.netN)}</td>
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 text-right tabular-nums text-foreground-muted">{fm(a.netN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGE 4 : BILAN DU SYSTÈME NORMAL — PASSIF                          */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-4 print:p-0 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page print-avoid-break space-y-1">
          <div className="text-center border-b border-foreground/30 pb-1 mb-1 print:pb-0.5 print:mb-0.5 leading-tight">
            <div className="flex justify-between items-center text-[9px] print:text-[8px] text-foreground-muted">
              <span className="font-semibold text-foreground">{etats.fiche.denomination}</span>
              <span>NINEA : {etats.fiche.nineaNif}</span>
            </div>
            <h2 className="text-xs print:text-[10px] font-black font-heading uppercase text-foreground">
              BILAN DU SYSTÈME NORMAL — PASSIF
            </h2>
            <p className="text-[9px] print:text-[7.5px] text-foreground-muted">
              Exercice clos au {etats.fiche.dateCloture} • Durée : {etats.fiche.dureeMois} mois
            </p>
          </div>

          <table className="w-full text-[9px] print:text-[7.5px] border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 border-r border-foreground/30 w-8">Réf.</th>
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 border-r border-foreground/30 text-left">PASSIF</th>
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 border-r border-foreground/30 w-10">Note</th>
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 border-r border-foreground/30 text-right w-28 font-bold">Net ({libN})</th>
                <th className="py-0.5 px-1 print:py-[1px] print:px-0.5 text-right w-28 text-foreground-muted">Net ({libN1})</th>
              </tr>
            </thead>
            <tbody>
              {etats.bilanPassif.map((p) => (
                <tr
                  key={p.ref}
                  className={`border-b border-foreground/20 leading-tight ${
                    p.estTotal ? 'font-bold bg-surface-elevated/40 print:bg-gray-100' : ''
                  }`}
                >
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-center font-mono">{p.ref}</td>
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30">{p.libelle}</td>
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-center text-foreground-muted">{p.note}</td>
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(p.netN)}</td>
                  <td className="py-[1.5px] px-1 print:py-[0.5px] print:px-0.5 text-right tabular-nums text-foreground-muted">{fm(p.netN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGE 5 : COMPTE DE RÉSULTAT DU SYSTÈME NORMAL                      */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-4 print:p-0 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page print-avoid-break space-y-1">
          <div className="text-center border-b border-foreground/30 pb-1 mb-1 print:pb-0.5 print:mb-0.5 leading-tight">
            <div className="flex justify-between items-center text-[9px] print:text-[8px] text-foreground-muted">
              <span className="font-semibold text-foreground">{etats.fiche.denomination}</span>
              <span>NINEA : {etats.fiche.nineaNif}</span>
            </div>
            <h2 className="text-xs print:text-[10px] font-black font-heading uppercase text-foreground">
              COMPTE DE RÉSULTAT DU SYSTÈME NORMAL
            </h2>
            <p className="text-[9px] print:text-[7.5px] text-foreground-muted">
              Exercice du 1er Janvier au 31 Décembre {libN} • Durée : {etats.fiche.dureeMois} mois
            </p>
          </div>

          <table className="w-full text-[8.5px] print:text-[6.8px] border border-foreground/40 border-collapse print-cdr-table">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="py-0.5 px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 w-8">Réf.</th>
                <th className="py-0.5 px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-left">LIBELLÉS DES OPÉRATIONS</th>
                <th className="py-0.5 px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 w-10">Note</th>
                <th className="py-0.5 px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-right w-24 font-bold">Exercice {libN}</th>
                <th className="py-0.5 px-1 print:py-[0.5px] print:px-0.5 text-right w-24 text-foreground-muted">Exercice {libN1}</th>
              </tr>
            </thead>
            <tbody>
              {etats.compteResultat.map((cr) => (
                <tr
                  key={cr.ref}
                  className={`border-b border-foreground/20 leading-none ${
                    cr.type === 'sig' ? 'font-bold bg-surface-elevated/40 print:bg-gray-100' : ''
                  }`}
                >
                  <td className="py-[1px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-center font-mono">{cr.ref}</td>
                  <td className="py-[1px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30">{cr.libelle}</td>
                  <td className="py-[1px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-center text-foreground-muted">{cr.note}</td>
                  <td className="py-[1px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(cr.montantN)}</td>
                  <td className="py-[1px] px-1 print:py-[0.5px] print:px-0.5 text-right tabular-nums text-foreground-muted">{fm(cr.montantN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGE 6 : TABLEAU DES FLUX DE TRÉSORERIE (TFT)                      */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-4 print:p-0 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page print-avoid-break space-y-1">
          <div className="text-center border-b border-foreground/30 pb-1 mb-1 print:pb-0.5 print:mb-0.5 leading-tight">
            <div className="flex justify-between items-center text-[9px] print:text-[8px] text-foreground-muted">
              <span className="font-semibold text-foreground">{etats.fiche.denomination}</span>
              <span>NINEA : {etats.fiche.nineaNif}</span>
            </div>
            <h2 className="text-xs print:text-[10px] font-black font-heading uppercase text-foreground">
              TABLEAU DES FLUX DE TRÉSORERIE (TFT)
            </h2>
            <p className="text-[9px] print:text-[7.5px] text-foreground-muted">
              Méthode indirecte SYSCOHADA • Exercice {libN}
            </p>
          </div>

          <table className="w-full text-[8.5px] print:text-[7px] border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="py-0.5 px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 w-8">Réf.</th>
                <th className="py-0.5 px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-left">LIBELLÉS DES FLUX DE TRÉSORERIE</th>
                <th className="py-0.5 px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 w-10">Note</th>
                <th className="py-0.5 px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-right w-24 font-bold">Exercice {libN}</th>
                <th className="py-0.5 px-1 print:py-[0.5px] print:px-0.5 text-right w-24 text-foreground-muted">Exercice {libN1}</th>
              </tr>
            </thead>
            <tbody>
              {etats.tft.map((tf) => (
                <tr
                  key={tf.ref}
                  className={`border-b border-foreground/20 leading-tight ${
                    tf.type === 'total'
                      ? 'font-bold bg-surface-elevated/50 print:bg-gray-100'
                      : tf.type === 'sous_total'
                        ? 'font-semibold bg-surface-elevated/20'
                        : ''
                  }`}
                >
                  <td className="py-[1px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-center font-mono">{tf.ref}</td>
                  <td className="py-[1px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30">{tf.libelle}</td>
                  <td className="py-[1px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-center text-foreground-muted">{tf.note ?? ''}</td>
                  <td className="py-[1px] px-1 print:py-[0.5px] print:px-0.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(tf.montantN)}</td>
                  <td className="py-[1px] px-1 print:py-[0.5px] print:px-0.5 text-right tabular-nums text-foreground-muted">{fm(tf.montantN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGE 7 : NOTE 34 : FICHE DE SYNTHÈSE DES PRINCIPAUX INDICATEURS     */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-6 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page space-y-2">
          <div className="text-center space-y-0.5 border-b border-foreground/30 pb-2">
            <h2 className="text-sm font-black font-heading uppercase text-foreground">
              NOTE 34 : FICHE DE SYNTHÈSE DES PRINCIPAUX INDICATEURS FINANCIERS
            </h2>
            <p className="text-[10px] text-foreground-muted">
              Ratios de rentabilité, Analyse du BFR, Fonds de Roulement et Trésorerie Nette
            </p>
          </div>

          <table className="w-full text-[9px] border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-1 border-r border-foreground/30 text-left">Indicateurs & Agrégats Financiers</th>
                <th className="p-1 border-r border-foreground/30 text-right w-28 font-bold">Exercice {libN}</th>
                <th className="p-1 border-r border-foreground/30 text-right w-28 text-foreground-muted">Exercice {libN1}</th>
                <th className="p-1 text-center w-20">Var. en %</th>
              </tr>
            </thead>
            <tbody>
              {etats.indicateurs.map((ind, i) => {
                if (ind.type === 'titre') {
                  return (
                    <tr key={i} className="bg-surface-elevated/80 print:bg-gray-200 font-bold border-y border-foreground/40">
                      <td colSpan={4} className="p-1 text-[9px] uppercase tracking-wider text-primary">
                        {ind.libelle}
                      </td>
                    </tr>
                  )
                }
                const varPct = typeof ind.montantN === 'number' && typeof ind.montantN1 === 'number' && ind.montantN1 !== 0
                  ? ((ind.montantN - ind.montantN1) / Math.abs(ind.montantN1) * 100).toFixed(1) + '%'
                  : '—'

                return (
                  <tr
                    key={i}
                    className={`border-b border-foreground/20 leading-tight ${
                      ind.type === 'total'
                        ? 'font-bold bg-surface-elevated/40 print:bg-gray-100'
                        : ind.type === 'sous_total'
                          ? 'font-semibold'
                          : ''
                    }`}
                  >
                    <td className="p-0.5 border-r border-foreground/30">{ind.libelle}</td>
                    <td className="p-0.5 border-r border-foreground/30 text-right tabular-nums font-semibold">
                      {typeof ind.montantN === 'number' ? fm(ind.montantN) : ind.montantN}
                    </td>
                    <td className="p-0.5 border-r border-foreground/30 text-right tabular-nums text-foreground-muted">
                      {typeof ind.montantN1 === 'number' ? fm(ind.montantN1) : ind.montantN1}
                    </td>
                    <td className="p-0.5 text-center tabular-nums text-[8.5px]">{varPct}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGES 8+ : LES NOTES ANNEXÉES APPLICABLES AVEC MULTI-COLONNES      */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-6 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none space-y-4">
          <div className="text-center border-b border-foreground/30 pb-2">
            <h2 className="text-sm font-black font-heading uppercase text-foreground">
              NOTES ANNEXÉES AUX ÉTATS FINANCIERS
            </h2>
            <p className="text-[10px] text-foreground-muted">
              {totalNotesImprimees} notes applicables{masquerNonChiffrees ? ' chiffrées' : ''} éditées avec colonnes officielles de mouvements, variations et échéances
            </p>
          </div>

          <div className="space-y-4">
            {notesAImprimer.map((note) => (
              <div
                key={note.id}
                className="border border-foreground/30 rounded-lg p-2.5 space-y-1.5 bg-surface-elevated/15 print:bg-transparent print-avoid-break"
              >
                <div className="flex justify-between items-center border-b border-foreground/30 pb-1">
                  <span className="font-bold text-primary text-xs">
                    {note.numero} — {note.nomNote}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                    Applicable (A)
                  </span>
                </div>

                {/* ---------------------------------------------------------- */}
                {/* 1. RENDU SPÉCIFIQUE NOTE 3A : IMMOBILISATIONS BRUTES      */}
                {/* ---------------------------------------------------------- */}
                {note.id === 'note-3a' ? (
                  <table className="w-full text-[8.5px] border border-foreground/30 border-collapse">
                    <thead>
                      <tr className="bg-surface-elevated/60 print:bg-gray-100 font-bold border-b border-foreground/30 text-center">
                        <th className="p-1 border-r border-foreground/20 text-left">RUBRIQUES</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-18">Brut ouv. (A)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-18">Acquisitions (B)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-12">Virements (+)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-12">Rééval.</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-14">Cessions (C)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-12">Virements (-)</th>
                        <th className="p-1 text-right w-18 font-bold">Brut clôt. (D)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {note.items.map((it, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-foreground/15 leading-tight ${
                            it.intitule.startsWith('TOTAL') || it.intitule === 'IMMOBILISATIONS INCORPORELLES' || it.intitule === 'IMMOBILISATIONS CORPORELLES'
                              ? 'font-bold bg-surface-elevated/30 print:bg-gray-50'
                              : ''
                          }`}
                        >
                          <td className="p-0.5 border-r border-foreground/20">{it.intitule}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{fm(Number(it.colA) || 0)}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{Number(it.colB) ? fm(Number(it.colB)) : '—'}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums text-foreground-muted">0</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums text-foreground-muted">0</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{Number(it.colE) ? fm(Number(it.colE)) : '0'}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums text-foreground-muted">0</td>
                          <td className="p-0.5 text-right tabular-nums font-semibold">{fm(Number(it.montantN) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : note.id === 'note-3b' ? (
                  /* ---------------------------------------------------------- */
                  /* 2. RENDU SPÉCIFIQUE NOTE 3B : LOCATION-ACQUISITION        */
                  /* ---------------------------------------------------------- */
                  <table className="w-full text-[9px] border border-foreground/30 border-collapse">
                    <thead>
                      <tr className="bg-surface-elevated/60 print:bg-gray-100 font-bold border-b border-foreground/30 text-center">
                        <th className="p-1 border-r border-foreground/20 text-left">RUBRIQUES</th>
                        <th className="p-1 border-r border-foreground/20 w-12">Nature</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-24">Brut ouv. (A)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-24">Acquisitions (B)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-20">Diminutions (C)</th>
                        <th className="p-1 text-right w-24 font-bold">Brut clôt. (D)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {note.items.map((it, idx) => (
                        <tr key={idx} className="border-b border-foreground/15 leading-tight">
                          <td className="p-0.5 border-r border-foreground/20 font-medium">{it.intitule}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-center">{it.detail || '—'}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{fm(Number(it.colA) || 0)}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{Number(it.colB) ? fm(Number(it.colB)) : '—'}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{Number(it.colC) ? fm(Number(it.colC)) : '—'}</td>
                          <td className="p-0.5 text-right tabular-nums font-semibold">{fm(Number(it.montantN) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : note.id === 'note-3c' ? (
                  /* ---------------------------------------------------------- */
                  /* 3. RENDU SPÉCIFIQUE NOTE 3C : AMORTISSEMENTS              */
                  /* ---------------------------------------------------------- */
                  <table className="w-full text-[8.5px] border border-foreground/30 border-collapse">
                    <thead>
                      <tr className="bg-surface-elevated/60 print:bg-gray-100 font-bold border-b border-foreground/30 text-center">
                        <th className="p-1 border-r border-foreground/20 text-left">RUBRIQUES</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-24">Amort. ouv. (A)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-24">Dotations exo (B)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-20">Sorties (C)</th>
                        <th className="p-1 text-right w-24 font-bold">Cumul clôt. (D=A+B-C)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {note.items.map((it, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-foreground/15 leading-tight ${
                            it.intitule.startsWith('TOTAL') || it.intitule === 'IMMOBILISATIONS INCORPORELLES' || it.intitule === 'IMMOBILISATIONS CORPORELLES'
                              ? 'font-bold bg-surface-elevated/30 print:bg-gray-50'
                              : ''
                          }`}
                        >
                          <td className="p-0.5 border-r border-foreground/20">{it.intitule}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{fm(Number(it.colA) || 0)}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{Number(it.colB) ? fm(Number(it.colB)) : '—'}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{Number(it.colC) ? fm(Number(it.colC)) : '0'}</td>
                          <td className="p-0.5 text-right tabular-nums font-semibold">{fm(Number(it.montantN) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : note.id === 'note-3d' ? (
                  /* ---------------------------------------------------------- */
                  /* 4. RENDU SPÉCIFIQUE NOTE 3D : PLUS/MOINS-VALUES DE CESSION */
                  /* ---------------------------------------------------------- */
                  <table className="w-full text-[9px] border border-foreground/30 border-collapse">
                    <thead>
                      <tr className="bg-surface-elevated/60 print:bg-gray-100 font-bold border-b border-foreground/30 text-center">
                        <th className="p-1 border-r border-foreground/20 text-left">Rubriques</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-20">Brut (A)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-20">Amort. (B)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-20">VNC (C=A-B)</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-20">Prix cession (D)</th>
                        <th className="p-1 text-right w-24 font-bold">Plus/Moins-value (E)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {note.items.map((it, idx) => (
                        <tr key={idx} className="border-b border-foreground/15 leading-tight">
                          <td className="p-0.5 border-r border-foreground/20 font-medium">{it.intitule}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{fm(Number(it.colA) || 0)}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{fm(Number(it.colB) || 0)}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{fm(Number(it.colC) || 0)}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{fm(Number(it.colD) || 0)}</td>
                          <td className="p-0.5 text-right tabular-nums font-semibold">{fm(Number(it.colE) || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : note.items.some((it) => it.colA !== undefined && it.colB !== undefined && it.colC !== undefined && note.id !== 'note-1') ? (
                  /* ---------------------------------------------------------- */
                  /* 5. NOTES AVEC ÉCHÉANCES : ≤ 1 an | 1 à 2 ans | > 2 ans    */
                  /* (Notes 4, 7, 8, 9, 16A, 17, 18, 19)                       */
                  /* ---------------------------------------------------------- */
                  <table className="w-full text-[9px] border border-foreground/30 border-collapse">
                    <thead>
                      <tr className="bg-surface-elevated/60 print:bg-gray-100 font-bold border-b border-foreground/30 text-center">
                        <th className="p-1 border-r border-foreground/20 text-left">Libellés</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-20 font-bold">Année {libN}</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-20 text-foreground-muted">Année {libN1}</th>
                        <th className="p-1 border-r border-foreground/20 text-center w-14">Var. %</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-16">≤ 1 an</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-16">1 à 2 ans</th>
                        <th className="p-1 text-right w-16">&gt; 2 ans</th>
                      </tr>
                    </thead>
                    <tbody>
                      {note.items.map((it, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-foreground/15 leading-tight ${
                            it.intitule.startsWith('TOTAL') ? 'font-bold bg-surface-elevated/30 print:bg-gray-50' : ''
                          }`}
                        >
                          <td className="p-0.5 border-r border-foreground/20">{it.intitule}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums font-semibold">
                            {typeof it.montantN === 'number' ? fm(it.montantN) : it.montantN}
                          </td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums text-foreground-muted">
                            {typeof it.montantN1 === 'number' ? fm(it.montantN1) : it.montantN1 ?? '—'}
                          </td>
                          <td className="p-0.5 border-r border-foreground/20 text-center tabular-nums text-[8.5px]">
                            {it.variationPct ?? '—'}
                          </td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{Number(it.colA) ? fm(Number(it.colA)) : '—'}</td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">{Number(it.colB) ? fm(Number(it.colB)) : '—'}</td>
                          <td className="p-0.5 text-right tabular-nums">{Number(it.colC) ? fm(Number(it.colC)) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  /* ---------------------------------------------------------- */
                  /* 6. TABLE STANDARD MULTI-COLONNES (VARIATION EN VALEUR & %) */
                  /* ---------------------------------------------------------- */
                  <table className="w-full text-[9px] border border-foreground/20 border-collapse">
                    <thead>
                      <tr className="bg-surface-elevated/50 print:bg-gray-100 font-bold border-b border-foreground/20 text-center">
                        <th className="p-1 border-r border-foreground/20 text-left">Rubrique / Libellé</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-24">Exercice {libN}</th>
                        <th className="p-1 border-r border-foreground/20 text-right w-24 text-foreground-muted">Exercice {libN1}</th>
                        {note.items.some((it) => it.variation !== undefined) && (
                          <th className="p-1 border-r border-foreground/20 text-right w-20">Var. en valeur</th>
                        )}
                        <th className="p-1 text-center w-16">Var. en %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {note.items.map((it, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-foreground/10 leading-tight ${
                            it.intitule.startsWith('TOTAL') ? 'font-bold bg-surface-elevated/30 print:bg-gray-50' : ''
                          }`}
                        >
                          <td className="p-0.5 border-r border-foreground/20">
                            <span>{it.intitule}</span>
                            {it.detail && <span className="block text-[8.5px] text-foreground-muted">{it.detail}</span>}
                          </td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums font-semibold">
                            {typeof it.montantN === 'number' ? fm(it.montantN) : it.montantN}
                          </td>
                          <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums text-foreground-muted">
                            {it.montantN1 !== undefined
                              ? typeof it.montantN1 === 'number'
                                ? fm(it.montantN1)
                                : it.montantN1
                              : '—'}
                          </td>
                          {note.items.some((item) => item.variation !== undefined) && (
                            <td className="p-0.5 border-r border-foreground/20 text-right tabular-nums">
                              {typeof it.variation === 'number' ? fm(it.variation) : it.variation ?? '—'}
                            </td>
                          )}
                          <td className="p-0.5 text-center tabular-nums text-[8.5px]">
                            {it.variationPct ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Sous-tableau spécial (ex: Engagements financiers Note 1, Transferts de charges Note 12) */}
                {note.sousTableau && (
                  <div className="pt-1.5 space-y-1">
                    <p className="text-[9px] font-bold text-foreground uppercase border-b border-foreground/20 pb-0.5">
                      {note.sousTableau.nomSousTableau}
                    </p>
                    <table className="w-full text-[9px] border border-foreground/20 border-collapse">
                      <thead>
                        <tr className="bg-surface-elevated/40 print:bg-gray-100 font-bold border-b border-foreground/20 text-center">
                          {note.sousTableau.colonnes.map((col, cIdx) => (
                            <th key={cIdx} className={`p-1 ${cIdx === 0 ? 'text-left' : 'text-right border-l border-foreground/20'}`}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {note.sousTableau.items.map((sIt, sIdx) => (
                          <tr key={sIdx} className="border-b border-foreground/10 leading-tight">
                            <td className="p-0.5">{sIt.intitule}</td>
                            <td className="p-0.5 text-right border-l border-foreground/20 tabular-nums">
                              {typeof sIt.colA === 'number' ? fm(sIt.colA) : sIt.colA ?? '—'}
                            </td>
                            <td className="p-0.5 text-right border-l border-foreground/20 tabular-nums">
                              {typeof sIt.colB === 'number' ? fm(sIt.colB) : sIt.colB ?? '—'}
                            </td>
                            <td className="p-0.5 text-right border-l border-foreground/20 tabular-nums">
                              {typeof sIt.colC === 'number' ? fm(sIt.colC) : sIt.colC ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {note.commentaires && (
                  <p className="text-[9px] text-foreground-muted italic pt-0.5">
                    Note : {note.commentaires}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* ================================================================== */}
          {/* DERNIÈRE PAGE : PIED DE PAGE TOUT AU BAS DU DOSSIER                */}
          {/* ================================================================== */}
          <div className="border-t-2 border-foreground/40 pt-3 mt-6 flex flex-wrap justify-between items-center text-[10px] text-foreground-muted print-avoid-break">
            <div>
              <span className="font-semibold text-foreground">Date et heure d&apos;édition : </span>
              <span>{dateEdition || '—'}</span>
            </div>
            <div className="font-mono text-center">
              <span>URL : </span>
              <span>{urlEdition || 'comptabilite/etats-financiers'}</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-foreground">D-AgroBusiness</span>
              <span> — Liasse Fiscale SYSCOHADA (Système Normal)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
