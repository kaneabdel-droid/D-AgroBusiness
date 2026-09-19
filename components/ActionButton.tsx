'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useT } from '@/components/I18nProvider'

type Resultat = { success: true } | { error: string }

/** Bouton d'action simple avec confirmation optionnelle et affichage de l'erreur renvoyée. */
export function ActionButton({
  label,
  action,
  confirmation,
  variant = 'outline',
  size = 'sm',
}: {
  label: string
  action: () => Promise<Resultat>
  confirmation?: string
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm'
}) {
  const { t } = useT()
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  function onClick() {
    if (confirmation && !window.confirm(confirmation)) return
    setErreur(null)
    startTransition(async () => {
      const res = await action()
      if ('error' in res) setErreur(res.error)
    })
  }

  return (
    <span className="inline-flex flex-col items-start">
      <Button type="button" size={size} variant={variant} onClick={onClick} disabled={pending}>
        {pending ? t('Patientez…') : label}
      </Button>
      {erreur && <span role="alert" className="mt-1 max-w-xs text-xs text-danger">{erreur}</span>}
    </span>
  )
}

/** Paiement d'une échéance : choix de la date et du compte de trésorerie. */
export function PayerEcheance({
  comptes,
  action,
}: {
  comptes: { id: string; label: string }[]
  action: (date: string, compteId: string) => Promise<Resultat>
}) {
  const { t } = useT()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [compte, setCompte] = useState(comptes[0]?.id ?? '')
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36 text-xs" aria-label={t('Date de paiement')} />
      <Select value={compte} onChange={(e) => setCompte(e.target.value)} className="h-8 w-40 text-xs" aria-label={t('Compte de trésorerie')}>
        {comptes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </Select>
      <Button
        type="button"
        size="sm"
        disabled={pending || !compte}
        onClick={() => {
          setErreur(null)
          startTransition(async () => {
            const res = await action(date, compte)
            if ('error' in res) setErreur(res.error)
          })
        }}
      >
        {pending ? '…' : t('Payer')}
      </Button>
      {erreur && <span role="alert" className="w-full text-xs text-danger">{erreur}</span>}
    </div>
  )
}
