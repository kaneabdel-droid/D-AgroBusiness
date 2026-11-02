'use client'

import { useState, useRef } from 'react'
import {
  Upload,
  FileSpreadsheet,
  FileText,
  FileCode,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Trash2,
  RefreshCw,
  Layers,
} from 'lucide-react'
import { importerEcrituresBatch, type ImportEcriturePayload } from '@/app/(app)/comptabilite/actions'

type ParsedRow = {
  id: string
  date: string
  journal: string
  piece: string
  compte: string
  libelle: string
  debit: number
  credit: number
}

export default function ImportJournauxModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileType, setFileType] = useState<'excel' | 'csv' | 'json' | 'pdf' | null>(null)
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calcule des totaux
  const totalDebit = rows.reduce((s, r) => s + (Number(r.debit) || 0), 0)
  const totalCredit = rows.reduce((s, r) => s + (Number(r.credit) || 0), 0)
  const ecart = Math.abs(totalDebit - totalCredit)
  const isEquilibre = rows.length > 0 && ecart < 0.01

  // Dynamic script loader helper
  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }
      const script = document.createElement('script')
      script.src = src
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Impossible de charger le script ${src}`))
      document.head.appendChild(script)
    })
  }

  // Traitement du fichier téléversé
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    const ext = file.name.split('.').pop()?.toLowerCase()

    try {
      if (ext === 'json') {
        setFileType('json')
        const text = await file.text()
        parseJson(text)
      } else if (ext === 'csv' || ext === 'tsv') {
        setFileType('csv')
        const text = await file.text()
        parseCsv(text)
      } else if (ext === 'xlsx' || ext === 'xls') {
        setFileType('excel')
        await parseExcel(file)
      } else if (ext === 'pdf') {
        setFileType('pdf')
        await parsePdf(file)
      } else {
        setErrorMsg('Format de fichier non pris en charge. Veuillez fournir un fichier .xlsx, .xls, .csv, .json ou .pdf.')
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(`Erreur lors de l'analyse du fichier : ${err.message || 'Format invalide'}`)
    } finally {
      setLoading(false)
    }
  }

  // Parseur JSON
  const parseJson = (content: string) => {
    const data = JSON.parse(content)
    const list = Array.isArray(data) ? data : data.ecritures || data.lignes || data.entries || []
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error('Le fichier JSON ne contient aucune liste d’écritures exploitable.')
    }

    const parsed: ParsedRow[] = []
    list.forEach((item: any, idx: number) => {
      // Cas 1: structure hiérarchique avec un tableau "lignes"
      if (Array.isArray(item.lignes)) {
        item.lignes.forEach((l: any, lIdx: number) => {
          parsed.push({
            id: `row-${idx}-${lIdx}`,
            date: item.date || item.date_ecriture || new Date().toISOString().split('T')[0],
            journal: (item.journal || 'od').toLowerCase(),
            piece: item.piece || item.numero_piece || `IMP-${idx + 1}`,
            compte: String(l.compte || l.numero_compte || ''),
            libelle: l.libelle || item.libelle || 'Écriture comptable',
            debit: parseFloat(l.debit || 0) || 0,
            credit: parseFloat(l.credit || 0) || 0,
          })
        })
      } else {
        // Cas 2: liste plate
        parsed.push({
          id: `row-${idx}`,
          date: item.date || item.date_ecriture || new Date().toISOString().split('T')[0],
          journal: (item.journal || 'od').toLowerCase(),
          piece: item.piece || item.numero_piece || `IMP-${idx + 1}`,
          compte: String(item.compte || item.numero_compte || item.account || ''),
          libelle: item.libelle || item.description || 'Écriture comptable',
          debit: parseFloat(item.debit || 0) || 0,
          credit: parseFloat(item.credit || 0) || 0,
        })
      }
    })

    setRows(parsed)
  }

  // Parseur CSV
  const parseCsv = (content: string) => {
    const lines = content.split(/\r\n|\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      throw new Error('Le fichier CSV doit comporter une ligne d’en-tête et au moins une ligne de données.')
    }

    // Détection du délimiteur (; ou , ou \t)
    const headerLine = lines[0]
    const separator = headerLine.includes(';') ? ';' : headerLine.includes('\t') ? '\t' : ','
    const headers = headerLine.split(separator).map((h) => h.replace(/["']/g, '').trim().toLowerCase())

    const dateIdx = headers.findIndex((h) => h.includes('date'))
    const journalIdx = headers.findIndex((h) => h.includes('journal') || h.includes('jrn'))
    const pieceIdx = headers.findIndex((h) => h.includes('piece') || h.includes('ref'))
    const compteIdx = headers.findIndex((h) => h.includes('compte') || h.includes('account'))
    const libelleIdx = headers.findIndex((h) => h.includes('libelle') || h.includes('designation') || h.includes('desc'))
    const debitIdx = headers.findIndex((h) => h.includes('debit'))
    const creditIdx = headers.findIndex((h) => h.includes('credit'))

    const parsed: ParsedRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const cols = line.split(separator).map((c) => c.replace(/["']/g, '').trim())
      if (cols.length < 3) continue

      const compte = compteIdx !== -1 ? cols[compteIdx] : cols[2] || ''
      if (!compte) continue

      const debit = debitIdx !== -1 ? parseFloat(cols[debitIdx].replace(/\s/g, '').replace(',', '.')) || 0 : 0
      const credit = creditIdx !== -1 ? parseFloat(cols[creditIdx].replace(/\s/g, '').replace(',', '.')) || 0 : 0

      parsed.push({
        id: `csv-${i}`,
        date: dateIdx !== -1 ? cols[dateIdx] : new Date().toISOString().split('T')[0],
        journal: journalIdx !== -1 ? (cols[journalIdx] || 'od').toLowerCase() : 'od',
        piece: pieceIdx !== -1 ? cols[pieceIdx] : `IMP-${i}`,
        compte,
        libelle: libelleIdx !== -1 ? cols[libelleIdx] : 'Écriture importée CSV',
        debit,
        credit,
      })
    }

    setRows(parsed)
  }

  // Parseur Excel (.xlsx, .xls)
  const parseExcel = async (file: File) => {
    await loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js')
    const XLSX = (window as any).XLSX
    if (!XLSX) throw new Error('Échec d’initialisation du moteur Excel')

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

    if (jsonRows.length === 0) {
      throw new Error('La feuille Excel est vide.')
    }

    const parsed: ParsedRow[] = jsonRows.map((r, idx) => {
      // Trouver les clés correspondantes
      const keys = Object.keys(r)
      const findVal = (keywords: string[]) => {
        const k = keys.find((key) => keywords.some((kw) => key.toLowerCase().includes(kw)))
        return k ? r[k] : ''
      }

      const dateVal = findVal(['date']) || new Date().toISOString().split('T')[0]
      const journalVal = (findVal(['journal', 'jrn']) || 'od').toLowerCase()
      const pieceVal = String(findVal(['piece', 'ref']) || `IMP-${idx + 1}`)
      const compteVal = String(findVal(['compte', 'num']) || '')
      const libelleVal = String(findVal(['libelle', 'designation', 'desc']) || 'Écriture Excel')
      const debitVal = parseFloat(String(findVal(['debit'])).replace(/\s/g, '').replace(',', '.')) || 0
      const creditVal = parseFloat(String(findVal(['credit'])).replace(/\s/g, '').replace(',', '.')) || 0

      return {
        id: `xls-${idx}`,
        date: String(dateVal),
        journal: journalVal,
        piece: pieceVal,
        compte: compteVal,
        libelle: libelleVal,
        debit: debitVal,
        credit: creditVal,
      }
    }).filter((r) => r.compte && (r.debit > 0 || r.credit > 0))

    setRows(parsed)
  }

  // Parseur PDF (recherche de patterns comptables : date, compte, libellé, montants)
  const parsePdf = async (file: File) => {
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js')
      const pdfjsLib = (window as any).pdfjsLib
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      let fullText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(' ')
        fullText += pageText + '\n'
      }

      // Extraction des lignes via expressions régulières
      const lines = fullText.split('\n')
      const parsed: ParsedRow[] = []

      // Recherche des lignes contenant un compte (4 à 8 chiffres) et des nombres décimaux
      const regexLine = /(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})?.*?(\b[1-8]\d{2,7}\b)(.*?)(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?)\s+(\d{1,3}(?:[\s.,]\d{3})*(?:[.,]\d{1,2})?)/g

      let match
      let idx = 1
      while ((match = regexLine.exec(fullText)) !== null) {
        const date = match[1] || new Date().toISOString().split('T')[0]
        const compte = match[2]
        const libelle = (match[3] || 'Ligne journal PDF').trim()
        const m1 = parseFloat(match[4].replace(/\s/g, '').replace(',', '.')) || 0
        const m2 = parseFloat(match[5].replace(/\s/g, '').replace(',', '.')) || 0

        parsed.push({
          id: `pdf-${idx}`,
          date,
          journal: 'od',
          piece: `PDF-${idx}`,
          compte,
          libelle: libelle.substring(0, 80),
          debit: m1,
          credit: m2,
        })
        idx++
      }

      if (parsed.length === 0) {
        throw new Error('Aucun motif de journal comptable détecté dans le PDF. Veuillez privilégier un fichier Excel ou CSV.')
      }

      setRows(parsed)
    } catch (e: any) {
      throw new Error(`Le parseur PDF n'a pas pu identifier la structure tabulaire : ${e.message}`)
    }
  }

  // Suppression d'une ligne
  const handleDeleteRow = (id: string) => {
    setRows(rows.filter((r) => r.id !== id))
  }

  // Téléchargement des gabarits
  const downloadTemplate = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      const csvContent =
        'date;journal;piece;compte;libelle;debit;credit\n' +
        '2026-10-25;achats;FAC-1001;601100;Achat Paracétamol 500mg;150000;0\n' +
        '2026-10-25;achats;FAC-1001;401100;Fournisseur Grossiste Pharma;0;150000\n' +
        '2026-10-26;ventes;VTE-2001;571100;Recette Caisse Espèces;85000;0\n' +
        '2026-10-26;ventes;VTE-2001;701100;Ventes Produits Officine;0;85000\n'
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'modele_import_journal_comptable.csv'
      a.click()
    } else {
      const jsonContent = JSON.stringify(
        [
          {
            date: '2026-10-25',
            journal: 'achats',
            piece: 'FAC-1001',
            compte: '601100',
            libelle: 'Achat Amoxicilline 1g',
            debit: 200000,
            credit: 0,
          },
          {
            date: '2026-10-25',
            journal: 'achats',
            piece: 'FAC-1001',
            compte: '401100',
            libelle: 'Fournisseur Répartiteur Pharma',
            debit: 0,
            credit: 200000,
          },
        ],
        null,
        2
      )
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'modele_import_journal_comptable.json'
      a.click()
    }
  }

  // Soumission finale vers la base
  const handleConfirmImport = async () => {
    if (rows.length === 0) return
    setLoading(true)
    setErrorMsg(null)

    // Regrouper par groupe (date + piece + libelle)
    const grouped = new Map<string, ImportEcriturePayload>()

    rows.forEach((r) => {
      const key = `${r.date}__${r.piece}__${r.libelle}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          date_ecriture: r.date,
          journal: r.journal,
          numero_piece: r.piece,
          libelle: r.libelle,
          lignes: [],
        })
      }
      grouped.get(key)!.lignes.push({
        compte: r.compte,
        libelle: r.libelle,
        debit: r.debit,
        credit: r.credit,
      })
    })

    const payload = Array.from(grouped.values())

    const res = await importerEcrituresBatch(payload)
    setLoading(false)

    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg(`${res.count || payload.length} écriture(s) comptable(s) importée(s) avec succès !`)
      setTimeout(() => {
        setIsOpen(false)
        setRows([])
        setFileName(null)
      }, 2000)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold border border-slate-700 transition-all shadow-xs cursor-pointer"
      >
        <Upload className="w-3.5 h-3.5 text-emerald-400" />
        <span>Importer Journaux (Excel/CSV/JSON/PDF)</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-4xl w-full relative max-h-[92vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Importation de Journaux Comptables Multi-Formats
                  </h3>
                  <p className="text-xs text-slate-400">
                    Prend en charge les fichiers Excel (.xlsx, .xls), CSV, JSON et relevés PDF
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Zone de notification */}
            {errorMsg && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Zone de Glisser-Déposer / Téléversement */}
            {rows.length === 0 ? (
              <div className="flex-1 py-10 flex flex-col items-center justify-center text-center space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full max-w-lg p-8 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-3xl bg-slate-950/60 cursor-pointer transition-colors flex flex-col items-center justify-center space-y-3 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      Cliquez pour sélectionner un fichier ou glissez-le ici
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Formats acceptés : <strong>.xlsx, .xls, .csv, .json, .pdf</strong>
                    </p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.json,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex items-center gap-3 pt-2">
                  <span className="text-xs text-slate-500">Gabarits types :</span>
                  <button
                    onClick={() => downloadTemplate('csv')}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Modèle CSV</span>
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    onClick={() => downloadTemplate('json')}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>Modèle JSON</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Tableau de prévisualisation avant validation */
              <div className="flex-1 flex flex-col overflow-hidden py-4 space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Fichier : {fileName}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono text-[10px]">
                      {rows.length} lignes détectées
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setRows([])
                        setFileName(null)
                      }}
                      className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px]"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Changer de fichier</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0">
                      <tr>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Journal</th>
                        <th className="px-3 py-2.5">N° Pièce</th>
                        <th className="px-3 py-2.5">Compte</th>
                        <th className="px-3 py-2.5">Libellé</th>
                        <th className="px-3 py-2.5 text-right">Débit</th>
                        <th className="px-3 py-2.5 text-right">Crédit</th>
                        <th className="px-3 py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {rows.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-900/50">
                          <td className="px-3 py-2 text-slate-400 text-[11px]">{r.date}</td>
                          <td className="px-3 py-2 uppercase text-[10px] text-amber-400">{r.journal}</td>
                          <td className="px-3 py-2 text-slate-400 text-[11px]">{r.piece}</td>
                          <td className="px-3 py-2 font-bold text-white text-[11px]">{r.compte}</td>
                          <td className="px-3 py-2 font-sans text-slate-200 text-xs truncate max-w-[200px]">
                            {r.libelle}
                          </td>
                          <td className="px-3 py-2 text-right text-emerald-400">
                            {r.debit > 0 ? r.debit.toLocaleString('fr-FR') : '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-sky-400">
                            {r.credit > 0 ? r.credit.toLocaleString('fr-FR') : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleDeleteRow(r.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Synthèse Débit / Crédit & Équilibre */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-6 font-mono text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] block">TOTAL DÉBIT</span>
                      <span className="text-sm font-bold text-emerald-400">
                        {totalDebit.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">TOTAL CRÉDIT</span>
                      <span className="text-sm font-bold text-sky-400">
                        {totalCredit.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">ÉCART</span>
                      <span
                        className={`text-sm font-bold ${
                          isEquilibre ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {ecart.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isEquilibre ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Partie Double Équilibrée</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Écriture déséquilibrée</span>
                      </span>
                    )}

                    <button
                      onClick={handleConfirmImport}
                      disabled={loading || rows.length === 0}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {loading ? (
                        <span>Importation en cours...</span>
                      ) : (
                        <>
                          <span>Valider & Importer</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
