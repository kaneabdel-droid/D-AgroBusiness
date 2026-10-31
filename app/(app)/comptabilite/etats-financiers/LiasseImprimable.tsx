'use client'

import React from 'react'
import {
  Printer,
  Download,
  Building,
  Scale,
  FileText,
  ArrowRightLeft,
  CheckCircle,
  ShieldCheck,
  Calendar,
} from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import type { Lang } from '@/lib/i18n'
import {
  type EtatsFinanciersSyscohada,
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

  const telechargerCSV = () => {
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

  return (
    <div className="space-y-6">
      {/* Barre d'action supérieure (masquée à l'impression) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 bg-surface p-4 rounded-xl border border-surface-border">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary" />
            Édition Officielle de la Liasse Financière (Format Imprimable & PDF)
          </h3>
          <p className="text-xs text-foreground-muted mt-0.5">
            Mise en page normalisée avec sauts de page A4 pour dépôt fiscal DGID et certification
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

      {/* Conteneur imprimable */}
      <div className="print:m-0 print:p-0 space-y-8 print:space-y-0 text-foreground">
        {/* ================================================================== */}
        {/* PAGE 1 : PAGE DE GARDE OFFICIELLE DGID                             */}
        {/* ================================================================== */}
        <div className="bg-surface print:bg-white p-8 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print:break-after-page min-h-[1050px] flex flex-col justify-between">
          <div className="space-y-6 text-center">
            <div className="border-b-2 border-foreground/80 pb-4 space-y-1">
              <p className="text-sm font-black uppercase tracking-widest text-foreground">
                {etats.fiche.pays}
              </p>
              <p className="text-xs uppercase font-medium text-foreground-muted">
                {etats.fiche.ministere}
              </p>
              <p className="text-xs uppercase font-bold text-foreground">
                {etats.fiche.direction}
              </p>
              <p className="text-xs font-semibold text-primary mt-1">
                {etats.fiche.centreDepot}
              </p>
            </div>

            <div className="py-6 space-y-2">
              <span className="inline-block px-3 py-1 text-xs font-black uppercase rounded bg-primary/10 text-primary border border-primary/20 tracking-wider">
                SYSTÈME NORMAL
              </span>
              <h1 className="text-2xl font-black font-heading text-foreground uppercase tracking-wide">
                ÉTATS FINANCIERS NORMALISÉS DU SYSTÈME COMPTABLE OUEST AFRICAIN (SYSCOHADA)
              </h1>
              <p className="text-sm font-bold text-foreground">
                EXERCICE CLOS AU {new Date(etats.fiche.dateCloture).toLocaleDateString('fr-FR')} • DURÉE : {etats.fiche.dureeMois} MOIS
              </p>
            </div>

            {/* Cadre Désignation Entreprise */}
            <div className="border-2 border-foreground/60 rounded-lg p-5 text-left space-y-3 bg-surface-elevated/40 print:bg-transparent">
              <p className="text-xs font-black uppercase tracking-wider text-primary border-b border-foreground/20 pb-1">
                DÉSIGNATION DE L&apos;ENTREPRISE
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-foreground-muted block">Dénomination sociale :</span>
                  <span className="font-bold text-foreground text-sm">{etats.fiche.denomination}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block">Sigle usuel :</span>
                  <span className="font-bold text-foreground text-sm">{etats.fiche.sigle}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block">N° d&apos;identification fiscale (NINEA / NIF) :</span>
                  <span className="font-mono font-bold text-primary text-sm">{etats.fiche.nineaNif}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block">Période comptable :</span>
                  <span className="font-medium text-foreground">Du {etats.fiche.dateDebut} au {etats.fiche.dateFin}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-foreground-muted block">Adresse géographique complète :</span>
                  <span className="font-medium text-foreground">{etats.fiche.adresse}</span>
                </div>
              </div>
            </div>

            {/* Documents déposés & cadre de dépôt */}
            <div className="grid grid-cols-2 gap-6 text-left text-xs pt-4">
              <div className="border border-foreground/40 rounded-lg p-4 space-y-2">
                <p className="font-bold uppercase text-foreground border-b pb-1">Documents Déposés</p>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked readOnly className="accent-primary" />
                    <span>Fiche d&apos;identification & renseignements divers</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked readOnly className="accent-primary" />
                    <span>Bilan du Système Normal (Actif & Passif)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked readOnly className="accent-primary" />
                    <span>Compte de Résultat</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked readOnly className="accent-primary" />
                    <span>Tableau des Flux de Trésorerie (TFT)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked readOnly className="accent-primary" />
                    <span>Notes Annexées (Liasse des 36 Notes)</span>
                  </label>
                </div>
              </div>

              <div className="border border-foreground/40 rounded-lg p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <p className="font-bold uppercase text-foreground border-b pb-1">Réservé à l&apos;Administration Fiscale (DGID)</p>
                  <p className="text-[11px] text-foreground-muted mt-2">Date de réception : _____________________</p>
                  <p className="text-[11px] text-foreground-muted mt-2">Nom de l&apos;agent : _________________________</p>
                </div>
                <div className="border-t border-dashed pt-2 text-center text-[10px] text-foreground-muted">
                  Cachet officiel du Centre des Services Fiscaux
                </div>
              </div>
            </div>
          </div>

          {/* Bas de page officiel */}
          <div className="pt-8 border-t border-foreground/30 flex justify-between items-end text-xs">
            <div>
              <p className="text-foreground-muted">Certifié conforme par :</p>
              <p className="font-bold text-foreground">{etats.fiche.signataireNom}</p>
              <p className="text-[11px] text-foreground-muted">{etats.fiche.signataireQualite}</p>
            </div>
            <div className="text-right">
              <p className="text-foreground-muted">Signature & Cachet de l&apos;Entreprise</p>
              <div className="w-48 h-16 border border-dashed border-foreground/40 rounded mt-1"></div>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* PAGE 2 : FICHE D'IDENTIFICATION & RENSEIGNEMENTS DIVERS            */}
        {/* ================================================================== */}
        <div className="bg-surface print:bg-white p-8 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print:break-after-page min-h-[1050px] space-y-6">
          <div className="border-b border-foreground/40 pb-2 flex justify-between items-center text-xs">
            <span className="font-bold text-primary">{etats.fiche.denomination}</span>
            <span className="font-mono font-semibold">NINEA : {etats.fiche.nineaNif}</span>
            <span className="text-foreground-muted">Exercice clos au {etats.fiche.dateCloture}</span>
          </div>

          <h2 className="text-base font-bold font-heading uppercase text-foreground text-center border-b-2 border-foreground/60 pb-2">
            FICHE D&apos;IDENTIFICATION ET RENSEIGNEMENTS DIVERS
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="border border-surface-border p-3 rounded-lg space-y-2">
              <p className="font-bold text-primary uppercase text-[11px]">Identification de l&apos;Entité</p>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-foreground-muted">Dénomination :</span><span className="font-semibold">{etats.fiche.denomination}</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Sigle :</span><span className="font-semibold">{etats.fiche.sigle}</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Adresse géographique :</span><span>{etats.fiche.adresse}</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">N° d&apos;identification fiscale :</span><span className="font-mono font-bold text-primary">{etats.fiche.nineaNif}</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Exercice comptable :</span><span>Du {etats.fiche.dateDebut} au {etats.fiche.dateFin}</span></div>
              </div>
            </div>

            <div className="border border-surface-border p-3 rounded-lg space-y-2">
              <p className="font-bold text-primary uppercase text-[11px]">Cadre Réglementaire & Fiscal</p>
              <div className="space-y-1">
                <div className="flex justify-between"><span className="text-foreground-muted">Forme juridique (Code 02) :</span><span className="font-semibold">Société Commerciale (SARL / SAS)</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Régime fiscal (Code 1) :</span><span className="font-semibold">Réel Normal (SYSCOHADA)</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Pays siège (Code 07) :</span><span>Sénégal (UEMOA)</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Nomenclature activité :</span><span className="font-mono font-semibold">038003</span></div>
                <div className="flex justify-between"><span className="text-foreground-muted">Activité principale :</span><span>{etats.fiche.activitePrincipale}</span></div>
              </div>
            </div>
          </div>

          {/* Tableau de pointage des 36 Notes */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              Tableau Récapitulatif des 36 Notes Annexées Déposées :
            </p>
            <table className="w-full text-xs border border-foreground/30 border-collapse">
              <thead>
                <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/30">
                  <th className="p-1.5 border-r border-foreground/30 text-center w-20">N° Note</th>
                  <th className="p-1.5 border-r border-foreground/30 text-left">Intitulé Officiel de la Note</th>
                  <th className="p-1.5 text-center w-24">Statut</th>
                </tr>
              </thead>
              <tbody>
                {etats.notesAnnexees.slice(0, 18).map((note) => (
                  <tr key={note.id} className="border-b border-foreground/20">
                    <td className="p-1 border-r border-foreground/30 text-center font-bold">{note.numero}</td>
                    <td className="p-1 border-r border-foreground/30 truncate max-w-[320px]">{note.nomNote}</td>
                    <td className="p-1 text-center font-semibold">{note.statut === 'A' ? 'Applicable' : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================================================================== */}
        {/* PAGE 3 : BILAN DU SYSTÈME NORMAL — ACTIF                           */}
        {/* ================================================================== */}
        <div className="bg-surface print:bg-white p-8 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print:break-after-page min-h-[1050px] space-y-4">
          <div className="border-b border-foreground/40 pb-2 flex justify-between items-center text-xs">
            <span className="font-bold text-primary">{etats.fiche.denomination}</span>
            <span className="font-mono font-semibold">NINEA : {etats.fiche.nineaNif}</span>
            <span className="text-foreground-muted">Exercice clos au {etats.fiche.dateCloture}</span>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-base font-bold font-heading uppercase text-foreground">
              BILAN DU SYSTÈME NORMAL — ACTIF
            </h2>
            <p className="text-xs text-foreground-muted">Montants exprimés en {devise}</p>
          </div>

          <table className="w-full text-xs border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-2 border-r border-foreground/30 w-12">Réf.</th>
                <th className="p-2 border-r border-foreground/30 text-left">ACTIF</th>
                <th className="p-2 border-r border-foreground/30 w-16">Note</th>
                <th className="p-2 border-r border-foreground/30 text-right w-24">Brut ({libN})</th>
                <th className="p-2 border-r border-foreground/30 text-right w-24">Amort./Prov.</th>
                <th className="p-2 border-r border-foreground/30 text-right w-24 font-bold">Net ({libN})</th>
                <th className="p-2 text-right w-24 text-foreground-muted">Net ({libN1})</th>
              </tr>
            </thead>
            <tbody>
              {etats.bilanActif.map((a) => (
                <tr
                  key={a.ref}
                  className={`border-b border-foreground/20 ${
                    a.estTotal ? 'font-bold bg-surface-elevated/40 print:bg-gray-100' : ''
                  }`}
                >
                  <td className="p-1.5 border-r border-foreground/30 text-center font-mono font-medium">{a.ref}</td>
                  <td className="p-1.5 border-r border-foreground/30">{a.libelle}</td>
                  <td className="p-1.5 border-r border-foreground/30 text-center text-foreground-muted">{a.note}</td>
                  <td className="p-1.5 border-r border-foreground/30 text-right tabular-nums">{a.brutN !== 0 ? fm(a.brutN) : '—'}</td>
                  <td className="p-1.5 border-r border-foreground/30 text-right tabular-nums">{a.amortN !== 0 ? fm(a.amortN) : '—'}</td>
                  <td className="p-1.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(a.netN)}</td>
                  <td className="p-1.5 text-right tabular-nums text-foreground-muted">{fm(a.netN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ================================================================== */}
        {/* PAGE 4 : BILAN DU SYSTÈME NORMAL — PASSIF                          */}
        {/* ================================================================== */}
        <div className="bg-surface print:bg-white p-8 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print:break-after-page min-h-[1050px] space-y-4">
          <div className="border-b border-foreground/40 pb-2 flex justify-between items-center text-xs">
            <span className="font-bold text-primary">{etats.fiche.denomination}</span>
            <span className="font-mono font-semibold">NINEA : {etats.fiche.nineaNif}</span>
            <span className="text-foreground-muted">Exercice clos au {etats.fiche.dateCloture}</span>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-base font-bold font-heading uppercase text-foreground">
              BILAN DU SYSTÈME NORMAL — PASSIF
            </h2>
            <p className="text-xs text-foreground-muted">Montants exprimés en {devise}</p>
          </div>

          <table className="w-full text-xs border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-2 border-r border-foreground/30 w-12">Réf.</th>
                <th className="p-2 border-r border-foreground/30 text-left">PASSIF</th>
                <th className="p-2 border-r border-foreground/30 w-16">Note</th>
                <th className="p-2 border-r border-foreground/30 text-right w-32 font-bold">Net ({libN})</th>
                <th className="p-2 text-right w-32 text-foreground-muted">Net ({libN1})</th>
              </tr>
            </thead>
            <tbody>
              {etats.bilanPassif.map((p) => (
                <tr
                  key={p.ref}
                  className={`border-b border-foreground/20 ${
                    p.estTotal ? 'font-bold bg-surface-elevated/40 print:bg-gray-100' : ''
                  }`}
                >
                  <td className="p-1.5 border-r border-foreground/30 text-center font-mono font-medium">{p.ref}</td>
                  <td className="p-1.5 border-r border-foreground/30">{p.libelle}</td>
                  <td className="p-1.5 border-r border-foreground/30 text-center text-foreground-muted">{p.note}</td>
                  <td className="p-1.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(p.netN)}</td>
                  <td className="p-1.5 text-right tabular-nums text-foreground-muted">{fm(p.netN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ================================================================== */}
        {/* PAGE 5 : COMPTE DE RÉSULTAT DU SYSTÈME NORMAL                      */}
        {/* ================================================================== */}
        <div className="bg-surface print:bg-white p-8 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print:break-after-page min-h-[1050px] space-y-4">
          <div className="border-b border-foreground/40 pb-2 flex justify-between items-center text-xs">
            <span className="font-bold text-primary">{etats.fiche.denomination}</span>
            <span className="font-mono font-semibold">NINEA : {etats.fiche.nineaNif}</span>
            <span className="text-foreground-muted">Exercice {libN}</span>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-base font-bold font-heading uppercase text-foreground">
              COMPTE DE RÉSULTAT DU SYSTÈME NORMAL
            </h2>
            <p className="text-xs text-foreground-muted">Soldes Intermédiaires de Gestion • Montants en {devise}</p>
          </div>

          <table className="w-full text-xs border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-2 border-r border-foreground/30 w-12">Réf.</th>
                <th className="p-2 border-r border-foreground/30 text-left">LIBELLÉS DES OPÉRATIONS</th>
                <th className="p-2 border-r border-foreground/30 w-16">Note</th>
                <th className="p-2 border-r border-foreground/30 text-right w-32 font-bold">Exercice {libN}</th>
                <th className="p-2 text-right w-32 text-foreground-muted">Exercice {libN1}</th>
              </tr>
            </thead>
            <tbody>
              {etats.compteResultat.map((cr) => (
                <tr
                  key={cr.ref}
                  className={`border-b border-foreground/20 ${
                    cr.type === 'sig' ? 'font-bold bg-surface-elevated/40 print:bg-gray-100' : ''
                  }`}
                >
                  <td className="p-1.5 border-r border-foreground/30 text-center font-mono font-medium">{cr.ref}</td>
                  <td className="p-1.5 border-r border-foreground/30">{cr.libelle}</td>
                  <td className="p-1.5 border-r border-foreground/30 text-center text-foreground-muted">{cr.note}</td>
                  <td className="p-1.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(cr.montantN)}</td>
                  <td className="p-1.5 text-right tabular-nums text-foreground-muted">{fm(cr.montantN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ================================================================== */}
        {/* PAGE 6 : TABLEAU DES FLUX DE TRÉSORERIE (TFT)                      */}
        {/* ================================================================== */}
        <div className="bg-surface print:bg-white p-8 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print:break-after-page min-h-[1050px] space-y-4">
          <div className="border-b border-foreground/40 pb-2 flex justify-between items-center text-xs">
            <span className="font-bold text-primary">{etats.fiche.denomination}</span>
            <span className="font-mono font-semibold">NINEA : {etats.fiche.nineaNif}</span>
            <span className="text-foreground-muted">Exercice {libN}</span>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-base font-bold font-heading uppercase text-foreground">
              TABLEAU DES FLUX DE TRÉSORERIE (TFT)
            </h2>
            <p className="text-xs text-foreground-muted">Méthode indirecte SYSCOHADA • Montants en {devise}</p>
          </div>

          <table className="w-full text-xs border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-2 border-r border-foreground/30 w-14">Réf.</th>
                <th className="p-2 border-r border-foreground/30 text-left">LIBELLÉS DES FLUX DE TRÉSORERIE</th>
                <th className="p-2 border-r border-foreground/30 w-16">Note</th>
                <th className="p-2 border-r border-foreground/30 text-right w-32 font-bold">Exercice {libN}</th>
                <th className="p-2 text-right w-32 text-foreground-muted">Exercice {libN1}</th>
              </tr>
            </thead>
            <tbody>
              {etats.tft.map((tf) => (
                <tr
                  key={tf.ref}
                  className={`border-b border-foreground/20 ${
                    tf.type === 'total'
                      ? 'font-bold bg-surface-elevated/50 print:bg-gray-100'
                      : tf.type === 'sous_total'
                      ? 'font-semibold bg-surface-elevated/20'
                      : ''
                  }`}
                >
                  <td className="p-1.5 border-r border-foreground/30 text-center font-mono font-medium">{tf.ref}</td>
                  <td className="p-1.5 border-r border-foreground/30">{tf.libelle}</td>
                  <td className="p-1.5 border-r border-foreground/30 text-center text-foreground-muted">{tf.note ?? ''}</td>
                  <td className="p-1.5 border-r border-foreground/30 text-right tabular-nums font-semibold">{fm(tf.montantN)}</td>
                  <td className="p-1.5 text-right tabular-nums text-foreground-muted">{fm(tf.montantN1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ================================================================== */}
        {/* PAGE 7 : NOTE 34 — INDICATEURS FINANCIERS                          */}
        {/* ================================================================== */}
        <div className="bg-surface print:bg-white p-8 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none print:break-after-page min-h-[1050px] space-y-4">
          <div className="border-b border-foreground/40 pb-2 flex justify-between items-center text-xs">
            <span className="font-bold text-primary">{etats.fiche.denomination}</span>
            <span className="font-mono font-semibold">NINEA : {etats.fiche.nineaNif}</span>
            <span className="text-foreground-muted">Exercice {libN}</span>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-base font-bold font-heading uppercase text-foreground">
              NOTE 34 : FICHE DE SYNTHÈSE DES PRINCIPAUX INDICATEURS FINANCIERS
            </h2>
            <p className="text-xs text-foreground-muted">Ratios de rentabilité, Analyse du BFR et Fonds de Roulement</p>
          </div>

          <table className="w-full text-xs border border-foreground/40 border-collapse">
            <thead>
              <tr className="bg-surface-elevated/70 print:bg-gray-100 font-bold border-b border-foreground/40 text-center">
                <th className="p-2 border-r border-foreground/30 w-24">Code</th>
                <th className="p-2 border-r border-foreground/30 text-left">Indicateurs & Agrégats Financiers</th>
                <th className="p-2 border-r border-foreground/30 text-right w-36 font-bold">Exercice {libN}</th>
                <th className="p-2 text-right w-36 text-foreground-muted">Exercice {libN1}</th>
              </tr>
            </thead>
            <tbody>
              {etats.indicateurs.map((ind, i) => {
                if (ind.type === 'titre') {
                  return (
                    <tr key={i} className="bg-surface-elevated/80 print:bg-gray-200 font-bold border-y border-foreground/40">
                      <td colSpan={4} className="p-2 text-xs uppercase tracking-wider text-primary">
                        {ind.libelle}
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr
                    key={i}
                    className={`border-b border-foreground/20 ${
                      ind.type === 'total'
                        ? 'font-bold bg-surface-elevated/40 print:bg-gray-100'
                        : ind.type === 'sous_total'
                        ? 'font-semibold'
                        : ''
                    }`}
                  >
                    <td className="p-1.5 border-r border-foreground/30 text-center font-mono font-medium">{ind.code}</td>
                    <td className="p-1.5 border-r border-foreground/30">{ind.libelle}</td>
                    <td className="p-1.5 border-r border-foreground/30 text-right tabular-nums font-semibold">
                      {typeof ind.montantN === 'number' ? fm(ind.montantN) : ind.montantN}
                    </td>
                    <td className="p-1.5 text-right tabular-nums text-foreground-muted">
                      {typeof ind.montantN1 === 'number' ? fm(ind.montantN1) : ind.montantN1}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ================================================================== */}
        {/* PAGES 8+ : LES 36 NOTES ANNEXÉES DÉTAILLÉES                        */}
        {/* ================================================================== */}
        <div className="bg-surface print:bg-white p-8 rounded-xl border border-surface-border print:border-none shadow-sm print:shadow-none space-y-8">
          <div className="border-b border-foreground/40 pb-2 flex justify-between items-center text-xs">
            <span className="font-bold text-primary">{etats.fiche.denomination}</span>
            <span className="font-mono font-semibold">NINEA : {etats.fiche.nineaNif}</span>
            <span className="text-foreground-muted">Liasse Complète SYSCOHADA</span>
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-base font-bold font-heading uppercase text-foreground">
              NOTES ANNEXÉES AUX ÉTATS FINANCIERS (NOTES 1 À 36)
            </h2>
            <p className="text-xs text-foreground-muted">Tableaux détaillés réglementaires normalisés</p>
          </div>

          <div className="space-y-6">
            {etats.notesAnnexees.map((note) => (
              <div
                key={note.id}
                className="border border-foreground/30 rounded-lg p-4 space-y-2 bg-surface-elevated/20 print:bg-transparent print:break-inside-avoid"
              >
                <div className="flex justify-between items-center border-b border-foreground/30 pb-1.5">
                  <span className="font-bold text-primary text-xs">
                    {note.numero} — {note.nomNote}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-border">
                    {note.statut === 'A' ? 'Applicable' : 'N/A'}
                  </span>
                </div>

                <table className="w-full text-xs border border-foreground/20 border-collapse">
                  <thead>
                    <tr className="bg-surface-elevated/50 print:bg-gray-100 font-bold border-b border-foreground/20 text-center">
                      <th className="p-1.5 border-r border-foreground/20 text-left">Rubrique</th>
                      <th className="p-1.5 border-r border-foreground/20 text-right w-28">Exercice {libN}</th>
                      <th className="p-1.5 text-right w-28 text-foreground-muted">Exercice {libN1}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {note.items.map((it, idx) => (
                      <tr key={idx} className="border-b border-foreground/10">
                        <td className="p-1 border-r border-foreground/20">
                          <span>{it.intitule}</span>
                          {it.detail && <span className="block text-[10px] text-foreground-muted">{it.detail}</span>}
                        </td>
                        <td className="p-1 border-r border-foreground/20 text-right tabular-nums font-semibold">
                          {typeof it.montantN === 'number' ? fm(it.montantN) : it.montantN}
                        </td>
                        <td className="p-1 text-right tabular-nums text-foreground-muted">
                          {it.montantN1 !== undefined
                            ? typeof it.montantN1 === 'number'
                              ? fm(it.montantN1)
                              : it.montantN1
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {note.commentaires && (
                  <p className="text-[11px] text-foreground-muted italic pt-1">
                    Note : {note.commentaires}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
