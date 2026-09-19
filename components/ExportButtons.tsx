'use client'

import { FileDown, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Cellule = string | number | null | undefined

/** Exports d'un état : CSV (ouvrable dans Excel, séparateur « ; ») et PDF. */
export function ExportButtons({
  titre,
  sousTitre,
  colonnes,
  lignes,
  fichier,
}: {
  titre: string
  sousTitre?: string
  colonnes: string[]
  lignes: Cellule[][]
  fichier: string
}) {
  function csv() {
    const echapper = (v: Cellule) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const contenu = [colonnes, ...lignes].map((l) => l.map(echapper).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fichier}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function pdf() {
    const { jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable')).default
    const doc = new jsPDF({ orientation: colonnes.length > 5 ? 'landscape' : 'portrait' })
    doc.setFontSize(14)
    doc.text(titre, 14, 16)
    if (sousTitre) {
      doc.setFontSize(9)
      doc.text(sousTitre, 14, 22)
    }
    autoTable(doc, {
      startY: sousTitre ? 27 : 22,
      head: [colonnes],
      body: lignes.map((l) => l.map((v) => String(v ?? ''))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 86, 49] },
    })
    doc.save(`${fichier}.pdf`)
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={csv}>
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden /> Excel (CSV)
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={pdf}>
        <FileDown className="h-3.5 w-3.5" aria-hidden /> PDF
      </Button>
    </>
  )
}
