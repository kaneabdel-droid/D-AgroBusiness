'use client'

import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/I18nProvider'
import { LOCALES, type Lang } from '@/lib/i18n'
import { imprimerHtml, echapper } from '@/lib/impression'
import { formatMontantExport } from '@/lib/utils'

export type BulletinPdf = {
  organisation: string
  lang: Lang
  periode: string
  matricule: string
  nom: string
  statut: string
  poste: string
  devise: string
  joursPayes: number
  brut: number
  retenues: number
  net: number
  chargesPatronales: number
  lignes: { libelle: string; type: string; base: number | null; taux: number | null; montant: number }[]
}

const TITRES: Record<string, string> = {
  gain: 'Gains',
  retenue_absence: 'Absences',
  retenue_salariale: 'Retenues salariales',
  charge_patronale: 'Charges patronales (hors net à payer)',
}

export function BulletinPdfButton({ data }: { data: BulletinPdf }) {
  const { t } = useT()

  async function generer() {
    if (data.lang === 'ar') return genererArabe()
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    // Espace normale (jamais l'espace insécable de toLocaleString, que jsPDF/Helvetica n'affiche pas) pour le séparateur de milliers.
    const fmt = (v: number) => formatMontantExport(v, data.devise === 'XOF' ? 0 : 2, data.lang !== 'en')

    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text(t('BULLETIN DE PAIE'), 14, 18)
    doc.setFontSize(10)
    doc.text(data.organisation, 14, 26)
    doc.text(`${t('Période')} : ${data.periode}`, 14, 32)
    doc.text(`${t('Matricule')} : ${data.matricule}`, 120, 26)
    doc.text(`${t('Nom')} : ${data.nom}`, 120, 32)
    doc.text(`${t('Statut')} : ${data.statut}${data.poste ? ` — ${data.poste}` : ''}`, 120, 38)
    doc.text(`${t('Jours payés')} : ${data.joursPayes}`, 14, 38)

    const corps: (string | { content: string; colSpan?: number; styles?: object })[][] = []
    for (const type of ['gain', 'retenue_absence', 'retenue_salariale', 'charge_patronale']) {
      // Une rubrique à montant nul n'est pas imprimée.
      const lignes = data.lignes.filter((l) => l.type === type && l.montant !== 0)
      if (lignes.length === 0) continue
      corps.push([{ content: t(TITRES[type]), colSpan: 4, styles: { fillColor: [230, 236, 233], fontStyle: 'bold' } }])
      for (const l of lignes) {
        corps.push([
          l.libelle,
          l.base != null ? fmt(l.base) : '',
          l.taux != null && l.taux !== 0 ? `${l.taux} %` : '',
          fmt(l.montant),
        ])
      }
    }
    autoTable(doc, {
      startY: 46,
      head: [[t('Libellé'), t('Base'), t('Taux'), `${t('Montant')} (${data.devise})`]],
      body: corps,
      styles: { fontSize: 9, overflow: 'linebreak' },
      // Largeurs fixes sur Base/Taux/Montant (le libellé prend le reste) pour que le montant ne retourne jamais à la ligne.
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 28, halign: 'right' },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 34, halign: 'right' },
      },
      headStyles: { fillColor: [30, 86, 49], fontSize: 8 },
    })

    const yTot = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    // Totaux sous forme de tableau à 2 lignes : la première ligne donne les titres, la seconde les montants.
    autoTable(doc, {
      startY: yTot,
      head: [[t('Brut'), t('Total retenues'), t('NET À PAYER'), t('Coût employeur')]],
      body: [[
        `${fmt(data.brut)} ${data.devise}`,
        `${fmt(data.retenues)} ${data.devise}`,
        { content: `${fmt(data.net)} ${data.devise}`, styles: { fontStyle: 'bold', fontSize: 12 } },
        `${fmt(data.brut + data.chargesPatronales)} ${data.devise}`,
      ]],
      styles: { fontSize: 10, halign: 'center', cellPadding: 3 },
      headStyles: { fillColor: [30, 86, 49], fontSize: 9 },
      theme: 'grid',
    })
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

    // Signatures : sur une nouvelle page si trop peu de place ne reste en bas de celle-ci.
    const pageH = doc.internal.pageSize.getHeight()
    let ySign = y + 20
    if (ySign > pageH - 25) {
      doc.addPage()
      ySign = 30
    }
    doc.setFontSize(10)
    doc.line(14, ySign, 80, ySign)
    doc.line(130, ySign, 196, ySign)
    doc.text(t('Signature de l’employé'), 47, ySign + 6, { align: 'center' })
    doc.text(t('Signature de l’employeur'), 163, ySign + 6, { align: 'center' })

    doc.save(`${t('bulletin')}-${data.matricule}-${data.periode.replace(/\s+/g, '-')}.pdf`)
  }

  // Arabe : document HTML imprimé par le navigateur (lettres reliées et écriture de droite à gauche)
  function genererArabe() {
    const dec = data.devise === 'XOF' ? 0 : 2
    const fmt = (v: number) => v.toLocaleString(LOCALES[data.lang], { minimumFractionDigits: dec, maximumFractionDigits: dec })
    const rows: string[] = []
    for (const type of ['gain', 'retenue_absence', 'retenue_salariale', 'charge_patronale']) {
      const ls = data.lignes.filter((l) => l.type === type && l.montant !== 0)
      if (ls.length === 0) continue
      rows.push(`<tr class="section"><td colspan="4">${echapper(t(TITRES[type]))}</td></tr>`)
      for (const l of ls) {
        rows.push(`<tr><td>${echapper(l.libelle)}</td><td class="n">${l.base != null ? fmt(l.base) : ''}</td><td class="n">${l.taux != null && l.taux !== 0 ? l.taux + ' %' : ''}</td><td class="n">${fmt(l.montant)}</td></tr>`)
      }
    }
    const corps = `<h1>${echapper(t('BULLETIN DE PAIE'))}</h1><p>${echapper(data.organisation)}</p>
<p>${echapper(t('Période'))} : ${echapper(data.periode)} — ${echapper(t('Matricule'))} : ${echapper(data.matricule)} — ${echapper(t('Nom'))} : ${echapper(data.nom)}</p>
<p>${echapper(t('Statut'))} : ${echapper(data.statut)}${data.poste ? ` — ${echapper(data.poste)}` : ''} — ${echapper(t('Jours payés'))} : ${data.joursPayes}</p>
<table><thead><tr><th>${echapper(t('Libellé'))}</th><th class="n">${echapper(t('Base'))}</th><th class="n">${echapper(t('Taux'))}</th><th class="n">${echapper(t('Montant'))} (${echapper(data.devise)})</th></tr></thead><tbody>${rows.join('')}</tbody></table>
<table class="totaux"><thead><tr><th>${echapper(t('Brut'))}</th><th>${echapper(t('Total retenues'))}</th><th>${echapper(t('NET À PAYER'))}</th><th>${echapper(t('Coût employeur'))}</th></tr></thead>
<tbody><tr><td>${fmt(data.brut)} ${echapper(data.devise)}</td><td>${fmt(data.retenues)} ${echapper(data.devise)}</td><td class="net">${fmt(data.net)} ${echapper(data.devise)}</td><td>${fmt(data.brut + data.chargesPatronales)} ${echapper(data.devise)}</td></tr></tbody></table>
<div class="signatures"><div><div class="ligne"></div>${echapper(t('Signature de l’employé'))}</div><div><div class="ligne"></div>${echapper(t('Signature de l’employeur'))}</div></div>`
    imprimerHtml(`${t('bulletin')}-${data.matricule}`, corps, data.lang)
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={generer}>
      <FileDown className="h-3.5 w-3.5" aria-hidden /> PDF
    </Button>
  )
}
