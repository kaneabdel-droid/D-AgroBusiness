'use client'

import { FileDown, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/I18nProvider'
import { imprimerHtml, tableauHtml, echapper } from '@/lib/impression'
import { formatMontantExport } from '@/lib/utils'

type Cellule = string | number | null | undefined
const formater = (v: Cellule) => (typeof v === 'number' ? formatMontantExport(v) : v)

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
  const { t, lang } = useT()

  function csv() {
    const echapperCellule = (v: Cellule) => `"${String(v ?? '').replace(/"/g, '""')}"`
    // Le titre et le sous-titre identifient le document (ex. « Bilan comparatif » vs « Compte de résultat comparatif ») :
    // sans eux, deux exports ouverts côte à côte dans un tableur sont indiscernables l'un de l'autre.
    const entete = [[titre], ...(sousTitre ? [[sousTitre]] : []), []]
    const corps = [colonnes, ...lignes.map((l) => l.map(formater))]
    const contenu = [...entete, ...corps].map((l) => l.map(echapperCellule).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fichier}.csv`
    a.click()
    // Révoquer immédiatement peut interrompre le téléchargement (le navigateur n'a pas fini de lire le blob) : on attend qu'il ait démarré.
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  async function pdf() {
    // Arabe : impression par le navigateur (lettres reliées et sens d’écriture gérés nativement)
    if (lang === 'ar') {
      imprimerHtml(titre, `<h1>${echapper(titre)}</h1>${sousTitre ? `<p>${echapper(sousTitre)}</p>` : ''}${tableauHtml(colonnes, lignes)}`, lang)
      return
    }
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
      body: lignes.map((l) => l.map((v) => String(formater(v) ?? ''))),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 86, 49] },
    })
    doc.save(`${fichier}.pdf`)
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={csv}>
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden /> {t('Excel (CSV)')}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={pdf}>
        <FileDown className="h-3.5 w-3.5" aria-hidden /> PDF
      </Button>
    </>
  )
}
