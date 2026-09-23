'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/components/I18nProvider'

type Resultat = { success: true } | { error: string }
type Employe = { id: string; label: string }
type Existant = { employeId: string; heures: number; montant: number | null }

export function HeuresSupForm({
  periodeId,
  employes,
  existants,
  modeForfait,
  action,
}: {
  periodeId: string
  employes: Employe[]
  existants: Existant[]
  modeForfait: boolean
  action: (periodeId: string, entries: { employeId: string; heures: number; montant?: number }[]) => Promise<Resultat>
}) {
  const { t } = useT()
  const depart = new Map(existants.map((x) => [x.employeId, x]))
  const [valeurs, setValeurs] = useState<Record<string, { heures: string; montant: string }>>(() =>
    Object.fromEntries(employes.map((e) => {
      const x = depart.get(e.id)
      return [e.id, { heures: x?.heures ? String(x.heures) : '', montant: x?.montant != null ? String(x.montant) : '' }]
    }))
  )
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  function maj(id: string, champ: 'heures' | 'montant', v: string) {
    setValeurs((prev) => ({ ...prev, [id]: { ...prev[id], [champ]: v } }))
  }

  function enregistrer() {
    setMessage(null)
    const entries = employes
      .map((e) => ({ employeId: e.id, heures: Number(valeurs[e.id]?.heures || 0), montant: valeurs[e.id]?.montant ? Number(valeurs[e.id].montant) : undefined }))
      .filter((x) => x.heures > 0 || (x.montant ?? 0) > 0 || depart.has(x.employeId))
    startTransition(async () => {
      const res = await action(periodeId, entries)
      if ('error' in res) setMessage({ ok: false, texte: res.error })
      else setMessage({ ok: true, texte: t('Heures supplémentaires enregistrées.') })
    })
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={pending} onClick={enregistrer}>
          {pending ? t('Enregistrement…') : t('Enregistrer les heures supplémentaires')}
        </Button>
        {message && <span role="status" className={`text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>{message.texte}</span>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-surface">
              <th className="border-b border-surface-border px-3 py-2 text-start font-semibold">{t('Employé')}</th>
              <th className="border-b border-surface-border px-3 py-2 text-end font-semibold">{t('Heures')}</th>
              {modeForfait && <th className="border-b border-surface-border px-3 py-2 text-end font-semibold">{t('Montant forfaitaire')}</th>}
            </tr>
          </thead>
          <tbody>
            {employes.map((e) => (
              <tr key={e.id}>
                <td className="border-b border-surface-border px-3 py-1.5">{e.label}</td>
                <td className="border-b border-surface-border px-3 py-1.5 text-end">
                  <Input type="number" min="0" step="0.5" value={valeurs[e.id]?.heures ?? ''} onChange={(ev) => maj(e.id, 'heures', ev.target.value)} className="h-8 w-24 text-end" />
                </td>
                {modeForfait && (
                  <td className="border-b border-surface-border px-3 py-1.5 text-end">
                    <Input type="number" min="0" step="0.01" value={valeurs[e.id]?.montant ?? ''} onChange={(ev) => maj(e.id, 'montant', ev.target.value)} className="h-8 w-32 text-end" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
