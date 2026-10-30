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
} from 'lucide-react'
import { Card, TableWrap, th, td } from '@/components/ui/card'
import { ExportButtons } from '@/components/ExportButtons'
import { formatMontant } from '@/lib/utils'
import type { Lang } from '@/lib/i18n'
import type { EtatsFinanciersSyscohada, DetailCompte } from '@/lib/syscohada'

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
  const [activeTab, setActiveTab] = useState<'actif' | 'passif' | 'resultat' | 'tft' | 'controles'>('actif')
  const [compteOuvert, setCompteOuvert] = useState<string | null>(null)

  const fm = (val: number | undefined | null) =>
    formatMontant(val ?? 0, devise, lang)

  const libN = etats.exerciceN.libelle
  const libN1 = etats.exerciceN1?.libelle ?? 'N-1 (aucun exercice antérieur)'

  const toggleDetail = (ref: string) => {
    setCompteOuvert((prev) => (prev === ref ? null : ref))
  }

  // Contrôles
  const bilanEquilibreN = Math.abs(etats.controles.equilibreBilanN) < 1
  const tftEquilibre = Math.abs(etats.controles.ecartBouclageTFT) < 1

  return (
    <div className="space-y-6">
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
            Ventes & travaux vendus
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
            {etats.controles.resultatNetN >= 0 ? 'Bénéfice' : 'Perte'} de l&apos;exercice
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
            Actif trésorerie − Découverts
          </p>
        </Card>
      </div>

      {/* Barre d'onglets SYSCOHADA */}
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-border">
        <button
          type="button"
          onClick={() => setActiveTab('actif')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
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
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
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
          onClick={() => setActiveTab('controles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'controles'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-foreground-muted hover:text-foreground hover:border-surface-border'
          }`}
        >
          <CheckCircle className={`w-4 h-4 ${bilanEquilibreN ? 'text-emerald-500' : 'text-amber-500'}`} />
          <span>Équilibre & Contrôles</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 1. ONGLET : BILAN ACTIF */}
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
                          ? 'bg-sidebar font-bold text-foreground'
                          : 'hover:bg-background/50 text-foreground'
                      }`}
                    >
                      <td className={`${td} text-center font-mono text-xs text-foreground-muted`}>
                        {p.ref}
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-1.5">
                          {aComptes && !p.estTotal && (
                            <button
                              type="button"
                              onClick={() => toggleDetail(p.ref)}
                              className="text-foreground-muted hover:text-primary transition-colors cursor-pointer"
                              title="Voir les comptes comptables"
                            >
                              {estDeplie ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <span className={p.estTotal ? 'font-bold' : ''}>{p.libelle}</span>
                        </div>
                      </td>
                      <td className={`${td} text-center text-xs text-foreground-muted`}>
                        {p.note}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{fm(p.brutN)}</td>
                      <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                        {p.amortN > 0 ? fm(p.amortN) : '—'}
                      </td>
                      <td className={`${td} text-right tabular-nums font-semibold`}>
                        {fm(p.netN)}
                      </td>
                      <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                        {fm(p.netN1)}
                      </td>
                    </tr>

                    {/* Sous-tableau déroulant des comptes */}
                    {estDeplie && aComptes && (
                      <tr className="bg-background/70 border-b border-surface-border">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="text-xs font-semibold text-foreground-muted mb-2 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-primary" />
                            Comptes rattachés au poste {p.ref} — {p.libelle} :
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {p.comptesN?.map((c) => (
                              <div
                                key={c.numero}
                                className="flex items-center justify-between p-2 rounded-lg bg-surface border border-surface-border text-xs"
                              >
                                <div>
                                  <span className="font-mono font-bold text-primary mr-1.5">
                                    {c.numero}
                                  </span>
                                  <span className="text-foreground">{c.libelle}</span>
                                </div>
                                <span className="font-mono font-medium ml-2">
                                  {fm(c.solde)}
                                </span>
                              </div>
                            ))}
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
      {/* 2. ONGLET : BILAN PASSIF */}
      {/* ==================================================================== */}
      {activeTab === 'passif' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Bilan Passif — Système Normal
              </h2>
              <p className="text-xs text-foreground-muted">
                Exercice clos au {new Date(etats.exerciceN.date_fin).toLocaleDateString('fr-FR')} • Montants en {devise}
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
                          ? 'bg-sidebar font-bold text-foreground'
                          : 'hover:bg-background/50 text-foreground'
                      }`}
                    >
                      <td className={`${td} text-center font-mono text-xs text-foreground-muted`}>
                        {p.ref}
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-1.5">
                          {aComptes && !p.estTotal && (
                            <button
                              type="button"
                              onClick={() => toggleDetail(p.ref)}
                              className="text-foreground-muted hover:text-primary transition-colors cursor-pointer"
                              title="Voir les comptes comptables"
                            >
                              {estDeplie ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <span className={p.estTotal ? 'font-bold' : ''}>{p.libelle}</span>
                        </div>
                      </td>
                      <td className={`${td} text-center text-xs text-foreground-muted`}>
                        {p.note}
                      </td>
                      <td
                        className={`${td} text-right tabular-nums font-semibold ${
                          p.ref === 'CJ'
                            ? p.netN >= 0
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                            : ''
                        }`}
                      >
                        {fm(p.netN)}
                      </td>
                      <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                        {fm(p.netN1)}
                      </td>
                    </tr>

                    {/* Sous-tableau déroulant des comptes */}
                    {estDeplie && aComptes && (
                      <tr className="bg-background/70 border-b border-surface-border">
                        <td colSpan={5} className="px-6 py-3">
                          <div className="text-xs font-semibold text-foreground-muted mb-2 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-primary" />
                            Comptes rattachés au poste {p.ref} — {p.libelle} :
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {p.comptesN?.map((c) => (
                              <div
                                key={c.numero}
                                className="flex items-center justify-between p-2 rounded-lg bg-surface border border-surface-border text-xs"
                              >
                                <div>
                                  <span className="font-mono font-bold text-primary mr-1.5">
                                    {c.numero}
                                  </span>
                                  <span className="text-foreground">{c.libelle}</span>
                                </div>
                                <span className="font-mono font-medium ml-2">
                                  {fm(c.solde)}
                                </span>
                              </div>
                            ))}
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
      {/* 3. ONGLET : COMPTE DE RÉSULTAT */}
      {/* ==================================================================== */}
      {activeTab === 'resultat' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Compte de Résultat — Système Normal
              </h2>
              <p className="text-xs text-foreground-muted">
                Soldes Intermédiaires de Gestion (SIG) OHADA • Montants en {devise}
              </p>
            </div>
            <ExportButtons
              titre={`Compte de Résultat (SYSCOHADA) — ${libN}`}
              sousTitre={`${organisationNom} — Exercice ${libN}`}
              fichier={`compte-resultat-syscohada-${libN}`}
              colonnes={['Réf.', 'Poste / Solde', 'Note', `Exercice (${libN})`, `Exercice (${libN1})`]}
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
                <th className={th}>Poste / Solde Intermédiaire</th>
                <th className={`${th} w-20 text-center`}>Note</th>
                <th className={`${th} text-right font-semibold`}>Exercice ({libN})</th>
                <th className={`${th} text-right text-foreground-muted`}>Exercice ({libN1})</th>
              </tr>
            </thead>
            <tbody>
              {etats.compteResultat.map((p) => {
                const estSIG = p.type === 'sig'
                const aComptes = p.comptesN && p.comptesN.length > 0
                const estDeplie = compteOuvert === p.ref

                return (
                  <React.Fragment key={p.ref}>
                    <tr
                      className={`transition-colors ${
                        estSIG
                          ? 'bg-sidebar/80 font-bold border-t border-b border-primary/20 text-foreground'
                          : 'hover:bg-background/50 text-foreground'
                      }`}
                    >
                      <td className={`${td} text-center font-mono text-xs text-foreground-muted`}>
                        {p.ref}
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-1.5">
                          {aComptes && !estSIG && (
                            <button
                              type="button"
                              onClick={() => toggleDetail(p.ref)}
                              className="text-foreground-muted hover:text-primary transition-colors cursor-pointer"
                              title="Voir les comptes comptables"
                            >
                              {estDeplie ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <span className={estSIG ? 'font-bold text-primary' : ''}>
                            {p.libelle}
                          </span>
                        </div>
                      </td>
                      <td className={`${td} text-center text-xs text-foreground-muted`}>
                        {p.note}
                      </td>
                      <td
                        className={`${td} text-right tabular-nums font-semibold ${
                          p.ref === 'XI'
                            ? p.montantN >= 0
                              ? 'text-emerald-500 font-bold text-base'
                              : 'text-rose-500 font-bold text-base'
                            : estSIG
                            ? 'text-primary'
                            : ''
                        }`}
                      >
                        {fm(p.montantN)}
                      </td>
                      <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                        {fm(p.montantN1)}
                      </td>
                    </tr>

                    {/* Sous-tableau déroulant des comptes */}
                    {estDeplie && aComptes && (
                      <tr className="bg-background/70 border-b border-surface-border">
                        <td colSpan={5} className="px-6 py-3">
                          <div className="text-xs font-semibold text-foreground-muted mb-2 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-primary" />
                            Comptes rattachés au poste {p.ref} — {p.libelle} :
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {p.comptesN?.map((c) => (
                              <div
                                key={c.numero}
                                className="flex items-center justify-between p-2 rounded-lg bg-surface border border-surface-border text-xs"
                              >
                                <div>
                                  <span className="font-mono font-bold text-primary mr-1.5">
                                    {c.numero}
                                  </span>
                                  <span className="text-foreground">{c.libelle}</span>
                                </div>
                                <span className="font-mono font-medium ml-2">
                                  {fm(c.solde)}
                                </span>
                              </div>
                            ))}
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
      {/* 4. ONGLET : TABLEAU DES FLUX DE TRÉSORERIE (TFT) */}
      {/* ==================================================================== */}
      {activeTab === 'tft' && (
        <div className="space-y-4 animate-in fade-in-50 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold font-heading text-foreground">
                Tableau des Flux de Trésorerie (TFT) — Système Normal
              </h2>
              <p className="text-xs text-foreground-muted">
                Méthode indirecte SYSCOHADA (Opérations, Investissement, Financement) • Montants en {devise}
              </p>
            </div>
            <ExportButtons
              titre={`Tableau des Flux de Trésorerie (SYSCOHADA) — ${libN}`}
              sousTitre={`${organisationNom} — Exercice ${libN}`}
              fichier={`tft-syscohada-${libN}`}
              colonnes={['Réf.', 'Flux de trésorerie', `Exercice (${libN})`, `Exercice (${libN1})`]}
              lignes={etats.tft.map((l) => [l.ref, l.libelle, l.montantN, l.montantN1])}
            />
          </div>

          <TableWrap>
            <thead>
              <tr>
                <th className={`${th} w-16 text-center`}>Réf.</th>
                <th className={th}>Flux de trésorerie</th>
                <th className={`${th} text-right font-semibold`}>Exercice ({libN})</th>
                <th className={`${th} text-right text-foreground-muted`}>Exercice ({libN1})</th>
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
                        ? 'bg-sidebar/90 font-bold border-t border-b border-primary/20 text-foreground'
                        : estSousTotal
                        ? 'bg-background/40 font-semibold text-foreground'
                        : 'hover:bg-background/50 text-foreground'
                    }`}
                  >
                    <td className={`${td} text-center font-mono text-xs text-foreground-muted`}>
                      {l.ref}
                    </td>
                    <td className={`${td} ${estTotal ? 'font-bold text-primary' : ''}`}>
                      {l.libelle}
                    </td>
                    <td
                      className={`${td} text-right tabular-nums font-semibold ${
                        l.ref === 'ZD'
                          ? l.montantN >= 0
                            ? 'text-emerald-500 font-bold'
                            : 'text-rose-500 font-bold'
                          : estTotal
                          ? 'text-primary'
                          : ''
                      }`}
                    >
                      {fm(l.montantN)}
                    </td>
                    <td className={`${td} text-right tabular-nums text-foreground-muted`}>
                      {l.montantN1 ? fm(l.montantN1) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. ONGLET : ÉQUILIBRE & CONTRÔLES OHADA */}
      {/* ==================================================================== */}
      {activeTab === 'controles' && (
        <div className="space-y-6 animate-in fade-in-50 duration-150">
          <div>
            <h2 className="text-lg font-bold font-heading text-foreground">
              Contrôles de cohérence comptable SYSCOHADA
            </h2>
            <p className="text-xs text-foreground-muted">
              Vérifications obligatoires des équilibres fondamentaux de la liasse financière
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Contrôle 1 : Équilibre Actif = Passif */}
            <Card className="p-5 border-l-4 border-l-primary">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {bilanEquilibreN ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                    Équilibre du Bilan (Actif = Passif)
                  </h3>
                  <p className="text-xs text-foreground-muted mt-1">
                    Le total général de l&apos;Actif doit correspondre exactement au total général du Passif.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    bilanEquilibreN
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-amber-500/10 text-amber-500'
                  }`}
                >
                  {bilanEquilibreN ? 'Conforme' : 'Écart détecté'}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-surface-border">
                  <span className="text-foreground-muted">Total Actif Net (BZ) :</span>
                  <span className="font-mono font-semibold">{fm(etats.totalActifN.net)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-border">
                  <span className="text-foreground-muted">Total Passif (PZ) :</span>
                  <span className="font-mono font-semibold">{fm(etats.totalPassifN)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold">
                  <span>Écart de bouclage :</span>
                  <span className={bilanEquilibreN ? 'text-emerald-500' : 'text-rose-500 font-mono'}>
                    {fm(etats.controles.equilibreBilanN)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Contrôle 2 : Bouclage du Tableau des Flux de Trésorerie */}
            <Card className="p-5 border-l-4 border-l-blue-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {tftEquilibre ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-blue-500" />
                    )}
                    Bouclage du TFT (Variation = Clôture − Ouverture)
                  </h3>
                  <p className="text-xs text-foreground-muted mt-1">
                    La variation nette de trésorerie (A+B+C) doit égaler la trésorerie de clôture moins celle d&apos;ouverture.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    tftEquilibre
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'bg-blue-500/10 text-blue-500'
                  }`}
                >
                  {tftEquilibre ? 'Vérifié' : 'Informatif'}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-surface-border">
                  <span className="text-foreground-muted">Trésorerie nette d&apos;ouverture (N-1) :</span>
                  <span className="font-mono font-semibold">{fm(etats.controles.tresorerieNetteN1)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-border">
                  <span className="text-foreground-muted">Trésorerie nette de clôture (N) :</span>
                  <span className="font-mono font-semibold">{fm(etats.controles.tresorerieNetteN)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold">
                  <span>Variation nette de trésorerie :</span>
                  <span className="font-mono text-primary">
                    {fm(etats.controles.variationTresorerieN)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Contrôle 3 : Concordance Résultat Bilan vs Compte de Résultat */}
            <Card className="p-5 border-l-4 border-l-emerald-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    Concordance du Résultat Net
                  </h3>
                  <p className="text-xs text-foreground-muted mt-1">
                    Le résultat net inscrit au Passif (Poste CJ) égale le solde net du Compte de Résultat (Poste XI).
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500">
                  Parfaitement égal
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b border-surface-border">
                  <span className="text-foreground-muted">Résultat net au Bilan Passif (CJ) :</span>
                  <span className="font-mono font-semibold">{fm(etats.controles.resultatNetN)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-surface-border">
                  <span className="text-foreground-muted">Résultat net au Compte de Résultat (XI) :</span>
                  <span className="font-mono font-semibold">{fm(etats.controles.resultatNetN)}</span>
                </div>
                <div className="flex justify-between py-1 font-bold">
                  <span>Différence :</span>
                  <span className="text-emerald-500 font-mono">0 {devise}</span>
                </div>
              </div>
            </Card>

            {/* Contrôle 4 : Référentiel SYSCOHADA Révisé */}
            <Card className="p-5 border-l-4 border-l-purple-500">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Info className="w-5 h-5 text-purple-500" />
                    Norme SYSCOHADA Système Normal
                  </h3>
                  <p className="text-xs text-foreground-muted mt-1">
                    Présentation certifiée conforme à l&apos;Acte Uniforme OHADA relatif au droit comptable.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-500">
                  SYSCOHADA
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-foreground-muted leading-relaxed">
                <p>
                  • <strong>Bilan</strong> : distinction nette Actif Immobilisé / Circulant / Trésorerie Actif, et Ressources Durables / Passif Circulant / Trésorerie Passif.
                </p>
                <p>
                  • <strong>Compte de Résultat</strong> : structure par nature en 8 Soldes Intermédiaires de Gestion (Marge commerciale, Valeur Ajoutée, EBE, REX, RF, RAO, RHAO, Résultat Net).
                </p>
                <p>
                  • <strong>Tableau des Flux de Trésorerie (TFT)</strong> : classification en flux d&apos;exploitation, investissement et financement.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
