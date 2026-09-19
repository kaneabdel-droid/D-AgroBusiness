'use client'

import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/I18nProvider'
import { LOCALES, type Lang } from '@/lib/i18n'

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
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const fmt = (v: number) => `${v.toLocaleString(LOCALES[data.lang], { minimumFractionDigits: data.devise === 'XOF' ? 0 : 2, maximumFractionDigits: data.devise === 'XOF' ? 0 : 2 })}`

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
      const lignes = data.lignes.filter((l) => l.type === type)
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
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      headStyles: { fillColor: [30, 86, 49] },
    })

    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
    doc.setFontSize(11)
    doc.text(`${t('Brut')} : ${fmt(data.brut)} ${data.devise}`, 14, y)
    doc.text(`${t('Total retenues')} : ${fmt(data.retenues)} ${data.devise}`, 14, y + 6)
    doc.setFontSize(13)
    doc.text(`${t('NET À PAYER')} : ${fmt(data.net)} ${data.devise}`, 14, y + 15)
    doc.setFontSize(9)
    doc.text(`${t('Coût employeur')} : ${fmt(data.brut + data.chargesPatronales)} ${data.devise}`, 14, y + 22)

    doc.save(`${t('bulletin')}-${data.matricule}-${data.periode.replace(/\s+/g, '-')}.pdf`)
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={generer}>
      <FileDown className="h-3.5 w-3.5" aria-hidden /> PDF
    </Button>
  )
}
