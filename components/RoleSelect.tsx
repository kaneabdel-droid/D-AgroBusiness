'use client'

import { useState, useTransition } from 'react'
import { Select } from '@/components/ui/input'
import { useT } from '@/components/I18nProvider'

type Resultat = { success: true } | { error: string }

/** Liste de rôles qui enregistre le choix dès qu'il change ; en cas d'erreur, l'ancien rôle est rétabli. */
export function RoleSelect({
  valeur,
  options,
  action,
  disabled,
}: {
  valeur: string
  options: { value: string; label: string }[]
  action: (role: string) => Promise<Resultat>
  disabled?: boolean
}) {
  const { t } = useT()
  const [courant, setCourant] = useState(valeur)
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <span className="inline-flex flex-col">
      <Select
        value={courant}
        disabled={disabled || pending}
        aria-label={t('Rôle')}
        className="h-8 w-52 text-xs"
        onChange={(e) => {
          const nouveau = e.target.value
          const ancien = courant
          setCourant(nouveau)
          setErreur(null)
          startTransition(async () => {
            const res = await action(nouveau)
            if ('error' in res) {
              setCourant(ancien)
              setErreur(res.error)
            }
          })
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
      {erreur && <span role="alert" className="mt-1 max-w-xs text-xs text-danger">{t(erreur)}</span>}
    </span>
  )
}
