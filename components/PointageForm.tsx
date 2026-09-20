'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useT } from '@/components/I18nProvider'
import { enregistrerPointages } from '@/app/(app)/rh/actions'

type Opt = { id: string; label: string }
type Employe = { id: string; label: string; statut: string; statutJour?: string }

const STATUTS = [
  { value: '', label: '—' },
  { value: 'present', label: 'Présent' },
  { value: 'demi_journee', label: 'Demi-journée' },
  { value: 'conge_paye', label: 'Congé payé' },
  { value: 'maladie', label: 'Maladie' },
  { value: 'absent', label: 'Absent' },
  { value: 'conge_sans_solde', label: 'Sans solde' },
]

/** Pointage d'une journée : tous les employés sur un seul écran, avec imputation commune (secteur, campagne). */
export function PointageForm({
  employes, secteurs, campagnes, date: dateInitiale,
}: {
  employes: Employe[]
  secteurs: (Opt & { departement_id: string })[]
  campagnes: Opt[]
  date: string
}) {
  const { t } = useT()
  const router = useRouter()
  const [date, setDate] = useState(dateInitiale)
  const [valeurs, setValeurs] = useState<Record<string, string>>(
    Object.fromEntries(employes.filter((e) => e.statutJour).map((e) => [e.id, e.statutJour as string]))
  )
  const [secteur, setSecteur] = useState('')
  const [campagne, setCampagne] = useState('')
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)

  function changerDate(d: string) {
    setDate(d)
    router.push(`/rh/pointage?date=${d}`)
  }

  function toutMarquer(statut: string) {
    setValeurs(Object.fromEntries(employes.map((e) => [e.id, statut])))
  }

  function enregistrer() {
    setMessage(null)
    const sec = secteurs.find((s) => s.id === secteur)
    startTransition(async () => {
      const res = await enregistrerPointages(
        date,
        employes
          .filter((e) => valeurs[e.id])
          .map((e) => ({
            employe_id: e.id,
            statut: valeurs[e.id],
            departement_id: sec?.departement_id,
            secteur_id: secteur || undefined,
            campagne_id: campagne || undefined,
          }))
      )
      setMessage('error' in res ? { type: 'erreur', texte: t(res.error) } : { type: 'ok', texte: t('Pointage enregistré.') })
    })
  }

  return (
    <div className="space-y-4">
      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">{t('Date')}</Label>
          <Input id="date" type="date" value={date} onChange={(e) => changerDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="secteur">{t('Imputer la journée au secteur / projet')}</Label>
          <Select id="secteur" value={secteur} onChange={(e) => setSecteur(e.target.value)}>
            <option value="">{t('Affectation habituelle')}</option>
            {secteurs.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="campagne">{t('Campagne')}</Label>
          <Select id="campagne" value={campagne} onChange={(e) => setCampagne(e.target.value)}>
            <option value="">—</option>
            {campagnes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button type="button" variant="outline" onClick={() => toutMarquer('present')}>{t('Tous présents')}</Button>
        </div>
      </Card>

      <Card className="divide-y divide-surface-border p-0 sm:p-0">
        {employes.map((e) => (
          <div key={e.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{e.label}</p>
              <p className="text-xs text-foreground-muted">{e.statut}</p>
            </div>
            <Select
              aria-label={t('Statut de {nom}', { nom: e.label })}
              value={valeurs[e.id] ?? ''}
              onChange={(ev) => setValeurs((v) => ({ ...v, [e.id]: ev.target.value }))}
              className="sm:w-48"
            >
              {STATUTS.map((s) => <option key={s.value} value={s.value}>{t(s.label)}</option>)}
            </Select>
          </div>
        ))}
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={enregistrer} disabled={pending}>
          {pending ? t('Enregistrement…') : t('Enregistrer le pointage')}
        </Button>
        {message && (
          <p role="status" className={message.type === 'ok' ? 'text-sm text-success' : 'text-sm text-danger'}>{message.texte}</p>
        )}
      </div>
    </div>
  )
}
