'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { formatMontant } from '@/lib/utils'
import { saisirEcriture, type LigneSaisie } from '@/app/(app)/comptabilite/actions'
import { useT } from '@/components/I18nProvider'

type Opt = { id: string; label: string }
type Secteur = Opt & { departement_id: string }

type LigneUI = {
  compte_id: string
  tiers_id: string
  libelle: string
  debit: string
  credit: string
  departement_id: string
  secteur_id: string
  campagne_id: string
}

const vide = (): LigneUI => ({
  compte_id: '', tiers_id: '', libelle: '', debit: '', credit: '',
  departement_id: '', secteur_id: '', campagne_id: '',
})

export function EcritureForm({
  journaux, comptes, tiers, departements, secteurs, campagnes, devise,
}: {
  journaux: Opt[]
  comptes: (Opt & { classe: number })[]
  tiers: Opt[]
  departements: Opt[]
  secteurs: Secteur[]
  campagnes: Opt[]
  devise: string
}) {
  const { t, lang } = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)
  const [journal, setJournal] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [libelle, setLibelle] = useState('')
  const [reference, setReference] = useState('')
  const [lignes, setLignes] = useState<LigneUI[]>([vide(), vide()])

  const totaux = useMemo(() => {
    const debit = lignes.reduce((s, l) => s + (Number(l.debit) || 0), 0)
    const credit = lignes.reduce((s, l) => s + (Number(l.credit) || 0), 0)
    return { debit, credit, ecart: Math.round((debit - credit) * 100) / 100 }
  }, [lignes])

  function maj(i: number, patch: Partial<LigneUI>) {
    setLignes((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  const classeDe = (id: string) => comptes.find((c) => c.id === id)?.classe

  function envoyer() {
    setErreur(null)
    startTransition(async () => {
      const payload: LigneSaisie[] = lignes.map((l) => ({
        compte_id: l.compte_id,
        tiers_id: l.tiers_id || undefined,
        libelle: l.libelle || undefined,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        departement_id: l.departement_id || undefined,
        secteur_id: l.secteur_id || undefined,
        campagne_id: l.campagne_id || undefined,
      }))
      const res = await saisirEcriture({ journal_id: journal, date, libelle, reference, lignes: payload })
      if ('error' in res) {
        setErreur(res.error)
        return
      }
      router.push('/comptabilite/ecritures')
    })
  }

  return (
    <div className="space-y-4">
      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="journal">{t('Journal')}</Label>
          <Select id="journal" value={journal} onChange={(e) => setJournal(e.target.value)}>
            <option value="">{t('Choisir…')}</option>
            {journaux.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="date">{t('Date')}</Label>
          <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reference">{t('Pièce')}</Label>
          <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="libelle">{t('Libellé')}</Label>
          <Input id="libelle" value={libelle} onChange={(e) => setLibelle(e.target.value)} />
        </div>
      </Card>

      {lignes.map((l, i) => {
        const analytiqueRequis = [6, 7].includes(classeDe(l.compte_id) ?? 0)
        const secteursDuDep = secteurs.filter((s) => s.departement_id === l.departement_id)
        return (
          <Card key={i} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor={`compte-${i}`}>{t('Compte')}</Label>
              <Select id={`compte-${i}`} value={l.compte_id} onChange={(e) => maj(i, { compte_id: e.target.value })}>
                <option value="">{t('Choisir…')}</option>
                {comptes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`debit-${i}`}>{t('Débit')}</Label>
              <Input id={`debit-${i}`} type="number" min="0" step="0.01" inputMode="decimal" value={l.debit}
                onChange={(e) => maj(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`credit-${i}`}>{t('Crédit')}</Label>
              <Input id={`credit-${i}`} type="number" min="0" step="0.01" inputMode="decimal" value={l.credit}
                onChange={(e) => maj(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`dep-${i}`}>{t('Département')}{analytiqueRequis && ' *'}</Label>
              <Select id={`dep-${i}`} value={l.departement_id}
                onChange={(e) => maj(i, { departement_id: e.target.value, secteur_id: '' })}>
                <option value="">—</option>
                {departements.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`sec-${i}`}>{t('Secteur / projet')}</Label>
              <Select id={`sec-${i}`} value={l.secteur_id} disabled={!l.departement_id}
                onChange={(e) => maj(i, { secteur_id: e.target.value })}>
                <option value="">—</option>
                {secteursDuDep.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`camp-${i}`}>{t('Campagne')}</Label>
              <Select id={`camp-${i}`} value={l.campagne_id} onChange={(e) => maj(i, { campagne_id: e.target.value })}>
                <option value="">—</option>
                {campagnes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`tiers-${i}`}>{t('Tiers')}</Label>
              <div className="flex gap-2">
                <Select id={`tiers-${i}`} value={l.tiers_id} onChange={(e) => maj(i, { tiers_id: e.target.value })}>
                  <option value="">—</option>
                  {tiers.map((ti) => <option key={ti.id} value={ti.id}>{ti.label}</option>)}
                </Select>
                {lignes.length > 2 && (
                  <Button type="button" variant="outline" size="icon" aria-label={t('Supprimer la ligne')}
                    onClick={() => setLignes((ls) => ls.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )
      })}

      <Button type="button" variant="outline" onClick={() => setLignes((ls) => [...ls, vide()])}>
        <Plus className="h-4 w-4" aria-hidden /> {t('Ajouter une ligne')}
      </Button>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div><dt className="text-foreground-muted">{t('Débit')}</dt><dd className="font-medium">{formatMontant(totaux.debit, devise, lang)}</dd></div>
          <div><dt className="text-foreground-muted">{t('Crédit')}</dt><dd className="font-medium">{formatMontant(totaux.credit, devise, lang)}</dd></div>
          <div>
            <dt className="text-foreground-muted">{t('Écart')}</dt>
            <dd className={totaux.ecart === 0 && totaux.debit > 0 ? 'font-medium text-success' : 'font-medium text-danger'}>
              {formatMontant(totaux.ecart, devise, lang)}
            </dd>
          </div>
        </dl>
        <Button type="button" onClick={envoyer} disabled={pending || totaux.ecart !== 0 || totaux.debit === 0}>
          {pending ? t('Enregistrement…') : t('Valider l’écriture')}
        </Button>
      </Card>
      {erreur && <p role="alert" className="text-sm text-danger">{t(erreur)}</p>}
    </div>
  )
}
