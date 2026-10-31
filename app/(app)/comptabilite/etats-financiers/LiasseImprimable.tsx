'use client'

import React, { useState, useEffect } from 'react'
import {
  Printer,
  Download,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
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
  const fm = (val: number | undefined | null) =>
    formatMontant(val ?? 0, devise, lang)

  const libN = etats.exerciceN.libelle
  const libN1 = etats.exerciceN1?.libelle ?? 'N-1'

  // État local pour la date et l'URL d'édition à afficher sur la dernière page
  const [dateEdition, setDateEdition] = useState<string>('')
  const [urlEdition, setUrlEdition] = useState<string>('')

  // NB: L'entreprise précise elle-même les notes applicables (A) ou non (N/A)
  const [notesStatut, setNotesStatut] = useState<Record<string, 'A' | 'N/A'>>(() => {
    const init: Record<string, 'A' | 'N/A'> = {}
    etats.notesAnnexees.forEach((n) => {
      // Notes par défaut applicables si solde > 0 ou obligatoires
      init[n.id] = n.statut
    })
    return init
  })

  const [afficherConfigNotes, setAfficherConfigNotes] = useState<boolean>(false)

  useEffect(() => {
    const now = new Date()
    setDateEdition(now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
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
      // Conserver obligatoires (Note 1, 2, 34)
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

  // Filtrer uniquement les notes applicables pour l'édition détaillée
  const notesApplicables = etats.notesAnnexees.filter((n) => notesStatut[n.id] === 'A')
  const totalNotesA = notesApplicables.length

  return (
    <div className="space-y-6">
      {/* Styles d'impression stricts A4 */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm 8mm 8mm 8mm;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            font-size: 11px;
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
              Conforme au modèle officiel DGID SYSCOHADA (Système Normal) • {totalNotesA} / 36 notes marquées Applicables (A)
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

        {/* Panneau de configuration des notes A / N/A */}
        <div className="border-t border-surface-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setAfficherConfigNotes((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Personnaliser les Notes Applicables (A) ou Non Applicables (N/A)</span>
              {afficherConfigNotes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={detectionAutomatique}
                className="px-2.5 py-1 text-[11px] font-medium rounded border border-surface-border bg-surface-elevated hover:bg-primary/10 transition-colors"
              >
                Détection automatique
              </button>
              <button
                type="button"
                onClick={appliquerToutesA}
                className="px-2.5 py-1 text-[11px] font-medium rounded border border-surface-border bg-surface-elevated hover:bg-primary/10 transition-colors"
              >
                Toutes Applicables (A)
              </button>
              <button
                type="button"
                onClick={appliquerToutesNA}
                className="px-2.5 py-1 text-[11px] font-medium rounded border border-surface-border bg-surface-elevated hover:bg-primary/10 transition-colors"
              >
                Toutes N/A
              </button>
            </div>
          </div>

          {afficherConfigNotes && (
            <div className="mt-3 p-3 bg-surface-elevated/40 rounded-lg border border-surface-border">
              <p className="text-[11px] text-foreground-muted mb-2">
                Cliquez sur une note pour basculer son statut. Seules les notes marquées <strong>(A)</strong> seront éditées dans le détail des notes. Toutes les notes figurent sur le tableau récapitulatif officiel de la page 2.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {etats.notesAnnexees.map((n) => {
                  const estA = notesStatut[n.id] === 'A'
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
                      <span className={`text-[9px] px-1 rounded ${estA ? 'bg-primary text-white' : 'bg-surface-border text-foreground-muted'}`}>
                        {estA ? 'A' : 'N/A'}
                      </span>
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
          <div className="space-y-4 text-center">
            {/* Sceau & Ministère */}
            <div className="border-b-2 border-foreground/80 pb-3 space-y-0.5">
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
                EXERCICE CLOS AU {new Date(etats.fiche.dateCloture).toLocaleDateString('fr-FR')} • DURÉE : {etats.fiche.dureeMois} MOIS
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
        <div className="bg-surface print:bg-white p-6 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page space-y-2">
          <div className="text-center space-y-0.5 border-b border-foreground/30 pb-2">
            <h2 className="text-sm font-black font-heading uppercase text-foreground">
              BILAN DU SYSTÈME NORMAL — ACTIF
            </h2>
            <p className="text-[10px] text-foreground-muted">
              Exercice clos au {etats.fiche.dateCloture} • Durée : {etats.fiche.dureeMois} mois • Montants exprimés en {devise}
            </p>
          </div>

          <table className="w-full text-[9.5px] border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-1 border-r border-foreground/30 w-10">Réf.</th>
                <th className="p-1 border-r border-foreground/30 text-left">ACTIF</th>
                <th className="p-1 border-r border-foreground/30 w-12">Note</th>
                <th className="p-1 border-r border-foreground/30 text-right w-24">Brut ({libN})</th>
                <th className="p-1 border-r border-foreground/30 text-right w-24">Amort./Prov.</th>
                <th className="p-1 border-r border-foreground/30 text-right w-24 font-bold">Net ({libN})</th>
                <th className="p-1 text-right w-24 text-foreground-muted">Net ({libN1})</th>
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
                  <td className="p-0.5 border-r border-foreground/30 text-center font-mono">{a.ref}</td>
                  <td className="p-0.5 border-r border-foreground/30">{a.libelle}</td>
                  <td className="p-0.5 border-r border-foreground/30 text-center text-foreground-muted">{a.note}</td>
                  <td className="p-0.5 border-r border-foreground/30 text-right tabular-nums">{a.brutN !== 0 ? fm(a.brutN) : '—'}</td>
                  <td className="p-0.5 border-r border-foreground/30 text-right tabular-nums">{a.amortN !== 0 ? fm(a.amortN) : '—'}</td>
                  <td className="p-0.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(a.netN)}</td>
                  <td className="p-0.5 text-right tabular-nums text-foreground-muted">{fm(a.netN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGE 4 : BILAN DU SYSTÈME NORMAL — PASSIF                          */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-6 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page space-y-2">
          <div className="text-center space-y-0.5 border-b border-foreground/30 pb-2">
            <h2 className="text-sm font-black font-heading uppercase text-foreground">
              BILAN DU SYSTÈME NORMAL — PASSIF
            </h2>
            <p className="text-[10px] text-foreground-muted">
              Exercice clos au {etats.fiche.dateCloture} • Durée : {etats.fiche.dureeMois} mois • Montants exprimés en {devise}
            </p>
          </div>

          <table className="w-full text-[9.5px] border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-1 border-r border-foreground/30 w-10">Réf.</th>
                <th className="p-1 border-r border-foreground/30 text-left">PASSIF</th>
                <th className="p-1 border-r border-foreground/30 w-12">Note</th>
                <th className="p-1 border-r border-foreground/30 text-right w-28 font-bold">Net ({libN})</th>
                <th className="p-1 text-right w-28 text-foreground-muted">Net ({libN1})</th>
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
                  <td className="p-0.5 border-r border-foreground/30 text-center font-mono">{p.ref}</td>
                  <td className="p-0.5 border-r border-foreground/30">{p.libelle}</td>
                  <td className="p-0.5 border-r border-foreground/30 text-center text-foreground-muted">{p.note}</td>
                  <td className="p-0.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(p.netN)}</td>
                  <td className="p-0.5 text-right tabular-nums text-foreground-muted">{fm(p.netN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGE 5 : COMPTE DE RÉSULTAT DU SYSTÈME NORMAL                      */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-6 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page space-y-2">
          <div className="text-center space-y-0.5 border-b border-foreground/30 pb-2">
            <h2 className="text-sm font-black font-heading uppercase text-foreground">
              COMPTE DE RÉSULTAT DU SYSTÈME NORMAL
            </h2>
            <p className="text-[10px] text-foreground-muted">
              Soldes Intermédiaires de Gestion • Exercice {libN} • Montants exprimés en {devise}
            </p>
          </div>

          <table className="w-full text-[9.5px] border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-1 border-r border-foreground/30 w-10">Réf.</th>
                <th className="p-1 border-r border-foreground/30 text-left">LIBELLÉS DES OPÉRATIONS</th>
                <th className="p-1 border-r border-foreground/30 w-12">Note</th>
                <th className="p-1 border-r border-foreground/30 text-right w-28 font-bold">Exercice {libN}</th>
                <th className="p-1 text-right w-28 text-foreground-muted">Exercice {libN1}</th>
              </tr>
            </thead>
            <tbody>
              {etats.compteResultat.map((cr) => (
                <tr
                  key={cr.ref}
                  className={`border-b border-foreground/20 leading-tight ${
                    cr.type === 'sig' ? 'font-bold bg-surface-elevated/40 print:bg-gray-100' : ''
                  }`}
                >
                  <td className="p-0.5 border-r border-foreground/30 text-center font-mono">{cr.ref}</td>
                  <td className="p-0.5 border-r border-foreground/30">{cr.libelle}</td>
                  <td className="p-0.5 border-r border-foreground/30 text-center text-foreground-muted">{cr.note}</td>
                  <td className="p-0.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(cr.montantN)}</td>
                  <td className="p-0.5 text-right tabular-nums text-foreground-muted">{fm(cr.montantN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGE 6 : TABLEAU DES FLUX DE TRÉSORERIE (TFT)                      */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-6 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print-break-page space-y-2">
          <div className="text-center space-y-0.5 border-b border-foreground/30 pb-2">
            <h2 className="text-sm font-black font-heading uppercase text-foreground">
              TABLEAU DES FLUX DE TRÉSORERIE (TFT)
            </h2>
            <p className="text-[10px] text-foreground-muted">
              Méthode indirecte SYSCOHADA • Exercice {libN} • Montants exprimés en {devise}
            </p>
          </div>

          <table className="w-full text-[9.5px] border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-1 border-r border-foreground/30 w-10">Réf.</th>
                <th className="p-1 border-r border-foreground/30 text-left">LIBELLÉS DES FLUX DE TRÉSORERIE</th>
                <th className="p-1 border-r border-foreground/30 w-12">Note</th>
                <th className="p-1 border-r border-foreground/30 text-right w-28 font-bold">Exercice {libN}</th>
                <th className="p-1 text-right w-28 text-foreground-muted">Exercice {libN1}</th>
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
                  <td className="p-0.5 border-r border-foreground/30 text-center font-mono">{tf.ref}</td>
                  <td className="p-0.5 border-r border-foreground/30">{tf.libelle}</td>
                  <td className="p-0.5 border-r border-foreground/30 text-center text-foreground-muted">{tf.note ?? ''}</td>
                  <td className="p-0.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(tf.montantN)}</td>
                  <td className="p-0.5 text-right tabular-nums text-foreground-muted">{fm(tf.montantN1)}</td>
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

          <table className="w-full text-[9.5px] border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-1 border-r border-foreground/30 w-16">Code</th>
                <th className="p-1 border-r border-foreground/30 text-left">Indicateurs & Agrégats Financiers</th>
                <th className="p-1 border-r border-foreground/30 text-right w-28 font-bold">Exercice {libN}</th>
                <th className="p-1 text-right w-28 text-foreground-muted">Exercice {libN1}</th>
              </tr>
            </thead>
            <tbody>
              {etats.indicateurs.map((ind, i) => {
                if (ind.type === 'titre') {
                  return (
                    <tr key={i} className="bg-surface-elevated/80 print:bg-gray-200 font-bold border-y border-foreground/40">
                      <td colSpan={4} className="p-1 text-[9.5px] uppercase tracking-wider text-primary">
                        {ind.libelle}
                      </td>
                    </tr>
                  )
                }
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
                    <td className="p-0.5 border-r border-foreground/30 text-center font-mono">{ind.code}</td>
                    <td className="p-0.5 border-r border-foreground/30">{ind.libelle}</td>
                    <td className="p-0.5 border-r border-foreground/30 text-right tabular-nums font-semibold">
                      {typeof ind.montantN === 'number' ? fm(ind.montantN) : ind.montantN}
                    </td>
                    <td className="p-0.5 text-right tabular-nums text-foreground-muted">
                      {typeof ind.montantN1 === 'number' ? fm(ind.montantN1) : ind.montantN1}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* PAGES 8+ : LES NOTES ANNEXÉES APPLICABLES (A) AVEC MULTI-COLONNES  */}
        {/* ------------------------------------------------------------------ */}
        <div className="bg-surface print:bg-white p-6 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none space-y-4">
          <div className="text-center border-b border-foreground/30 pb-2">
            <h2 className="text-sm font-black font-heading uppercase text-foreground">
              NOTES ANNEXÉES AUX ÉTATS FINANCIERS
            </h2>
            <p className="text-[10px] text-foreground-muted">
              Tableaux réglementaires normalisés pour les {totalNotesA} notes applicables à l&apos;exercice
            </p>
          </div>

          <div className="space-y-4">
            {notesApplicables.map((note) => (
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

                {/* Tableau principal de la note */}
                <table className="w-full text-[9px] border border-foreground/20 border-collapse">
                  <thead>
                    <tr className="bg-surface-elevated/50 print:bg-gray-100 font-bold border-b border-foreground/20 text-center">
                      <th className="p-1 border-r border-foreground/20 text-left">Rubrique / Libellé</th>
                      <th className="p-1 border-r border-foreground/20 text-right w-24">Exercice {libN}</th>
                      <th className="p-1 border-r border-foreground/20 text-right w-24 text-foreground-muted">Exercice {libN1}</th>
                      {note.items.some((it) => it.variation !== undefined) && (
                        <th className="p-1 text-center w-16">Variation</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {note.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-foreground/10 leading-tight">
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
                          <td className="p-0.5 text-center tabular-nums text-[8.5px]">
                            {it.variation ?? '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Sous-tableau spécial le cas échéant (ex: Engagements financiers Note 1) */}
                {note.sousTableau && (
                  <div className="pt-1 space-y-1">
                    <p className="text-[9px] font-bold text-foreground uppercase">{note.sousTableau.nomSousTableau}</p>
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
