'use client'

import { useState, useTransition } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/I18nProvider'
import { echapper, imprimerHtml } from '@/lib/impression'
import { formatDate, formatMontantExport } from '@/lib/utils'
import { donneesFacture } from '@/app/(app)/ventes/facture'
import type { EnteteEntreprise } from '@/lib/entreprise'

type Traduire = (texte: string, vars?: Record<string, string | number>) => string

/** En-tête d'un document : nom de l'entreprise puis ses coordonnées (seules les rubriques renseignées sont imprimées). */
function enteteHtml(e: EnteteEntreprise, t: Traduire) {
  const identification = [
    e.nif ? `${t('Identification fiscale')} : ${e.nif}` : '',
    e.rccm ? `${t('Registre du commerce')} : ${e.rccm}` : '',
  ].filter(Boolean).join(' · ')
  const contact = [
    e.telephone ? `${t('Téléphone')} : ${e.telephone}` : '',
    e.email ? `${t('Email')} : ${e.email}` : '',
  ].filter(Boolean).join(' · ')
  return `<div class="entete"><h1>${echapper(e.nom)}</h1>${e.adresse ? `<p>${echapper(e.adresse)}</p>` : ''}${identification ? `<p>${echapper(identification)}</p>` : ''}${contact ? `<p>${echapper(contact)}</p>` : ''}</div>`
}

const montant = (v: number, devise: string) => `${formatMontantExport(v, devise === 'XOF' ? 0 : 2)} ${devise}`

function tableau(colonnes: string[], lignes: string[][], numeriques: number[]) {
  const tete = colonnes.map((c, i) => `<th${numeriques.includes(i) ? ' class="n"' : ''}>${echapper(c)}</th>`).join('')
  const corps = lignes.map((l) => `<tr>${l.map((v, i) => `<td${numeriques.includes(i) ? ' class="n"' : ''}>${echapper(v)}</td>`).join('')}</tr>`).join('')
  return `<table><thead><tr>${tete}</tr></thead><tbody>${corps}</tbody></table>`
}

/** Imprime (ou enregistre en PDF) la facture d'une vente, avec les coordonnées de l'entreprise en en-tête. */
export function FactureButton({ venteId, numero }: { venteId: string; numero: string }) {
  const { t, lang } = useT()
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  function imprimer() {
    setErreur(null)
    startTransition(async () => {
      const d = await donneesFacture(venteId)
      if ('error' in d) {
        setErreur(d.error)
        return
      }
      const distribution = d.vente.type === 'distribution'
      const infosTiers = [d.tiers.adresse, d.tiers.telephone, d.tiers.nif ? `${t('Identification fiscale')} : ${d.tiers.nif}` : ''].filter(Boolean).join(' · ')
      const corps = [
        enteteHtml(d.entete, t),
        `<h2>${echapper(`${t('Facture')} ${d.vente.numero}`)}</h2>`,
        `<p>${echapper(t('Date'))} : ${echapper(formatDate(d.vente.date, lang))}${d.vente.campagne ? ` · ${echapper(t('Campagne'))} : ${echapper(d.vente.campagne)}` : ''}${d.vente.reference ? ` · ${echapper(t('Référence'))} : ${echapper(d.vente.reference)}` : ''}</p>`,
        `<p><strong>${echapper(distribution ? t('Producteur') : t('Client'))} :</strong> ${echapper(d.tiers.nom)} (${echapper(d.tiers.code)})</p>`,
        infosTiers ? `<p>${echapper(infosTiers)}</p>` : '',
        tableau(
          [t('Désignation'), t('Quantité'), t('Prix unitaire'), t('TVA %'), t('Montant HT')],
          d.lignes.map((l) => [
            l.designation,
            `${formatMontantExport(l.quantite, Number.isInteger(l.quantite) ? 0 : 3)} ${l.unite}`.trim(),
            formatMontantExport(l.prixUnitaire, d.devise === 'XOF' ? 0 : 2),
            `${l.tauxTva} %`,
            formatMontantExport(l.montantHt, d.devise === 'XOF' ? 0 : 2),
          ]),
          [1, 2, 3, 4]
        ),
        `<table class="recap"><tbody><tr><td>${echapper(t('Total HT'))}</td><td class="n">${echapper(montant(d.vente.totalHt, d.devise))}</td></tr><tr><td>${echapper(t('TVA'))}</td><td class="n">${echapper(montant(d.vente.totalTva, d.devise))}</td></tr><tr><td class="net">${echapper(t('Total TTC'))}</td><td class="n net">${echapper(montant(d.vente.totalTtc, d.devise))}</td></tr></tbody></table>`,
      ].join('')
      if (!imprimerHtml(`${t('Facture')} ${d.vente.numero}`, corps, lang)) setErreur('Autorisez les fenêtres pop-up pour imprimer.')
    })
  }

  return (
    <span className="inline-flex flex-col items-end">
      <Button type="button" size="sm" variant="outline" className="px-2" onClick={imprimer} disabled={pending} title={t('Imprimer la facture')} aria-label={`${t('Imprimer la facture')} ${numero}`}>
        <Printer className="h-4 w-4" aria-hidden />
      </Button>
      {erreur && <span role="alert" className="mt-1 max-w-xs text-end text-xs text-danger">{t(erreur)}</span>}
    </span>
  )
}

export type DonneesReleve = {
  entete: EnteteEntreprise
  devise: string
  tiers: { code: string; nom: string; adresse: string | null; nif: string | null }
  debut: string
  fin: string
  report: number
  lignes: { date: string; piece: string; libelle: string; debit: number; credit: number; solde: number }[]
  totalDebit: number
  totalCredit: number
  soldeFinal: number
}

/** Imprime (ou enregistre en PDF) le relevé de compte d'un tiers, avec les coordonnées de l'entreprise en en-tête. */
export function ReleveImprimerButton({ donnees: d }: { donnees: DonneesReleve }) {
  const { t, lang } = useT()
  const dec = d.devise === 'XOF' ? 0 : 2
  const f = (v: number) => formatMontantExport(v, dec)

  function imprimer() {
    const infosTiers = [d.tiers.adresse, d.tiers.nif ? `${t('Identification fiscale')} : ${d.tiers.nif}` : ''].filter(Boolean).join(' · ')
    const lignes: string[][] = [
      ['', '', t('Report à nouveau (avant le {d})', { d: formatDate(d.debut, lang) }), '', '', f(d.report)],
      ...d.lignes.map((l) => [formatDate(l.date, lang), l.piece, l.libelle, l.debit ? f(l.debit) : '', l.credit ? f(l.credit) : '', f(l.solde)]),
      ['', '', t('Totaux de la période'), f(d.totalDebit), f(d.totalCredit), f(d.soldeFinal)],
    ]
    const corps = [
      enteteHtml(d.entete, t),
      `<h2>${echapper(t('Relevé de compte'))}</h2>`,
      `<p><strong>${echapper(d.tiers.nom)}</strong> (${echapper(d.tiers.code)})</p>`,
      infosTiers ? `<p>${echapper(infosTiers)}</p>` : '',
      `<p>${echapper(t('du'))} ${echapper(formatDate(d.debut, lang))} ${echapper(t('au'))} ${echapper(formatDate(d.fin, lang))} · ${echapper(d.devise)}</p>`,
      tableau([t('Date'), t('Pièce'), t('Libellé'), t('Débit'), t('Crédit'), t('Solde')], lignes, [3, 4, 5]),
      `<p>${echapper(t('Solde positif : le tiers vous doit ce montant. Solde négatif : vous lui devez ce montant.'))}</p>`,
    ].join('')
    imprimerHtml(`${t('Relevé de compte')} — ${d.tiers.nom}`, corps, lang)
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={imprimer}>
      <Printer className="h-3.5 w-3.5" aria-hidden /> {t('Imprimer le relevé')}
    </Button>
  )
}
