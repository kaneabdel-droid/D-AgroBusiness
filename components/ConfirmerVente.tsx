'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/components/I18nProvider'

type Resultat = { success: true } | { error: string }

/** Ligne de vente proposée pour un lot : l'utilisateur ajuste la quantité puis confirme l'expédition. */
export function ConfirmerVente({
  maxQuantite,
  action,
}: {
  maxQuantite: number
  action: (quantite: number) => Promise<Resultat>
}) {
  const { t } = useT()
  const [quantite, setQuantite] = useState(String(maxQuantite))
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input type="number" step="0.001" min="0" max={maxQuantite} value={quantite} onChange={(e) => setQuantite(e.target.value)} className="h-8 w-28 text-xs" aria-label={t('Quantité')} />
      <Button
        type="button"
        size="sm"
        disabled={pending || !(Number(quantite) > 0)}
        onClick={() => {
          setErreur(null)
          startTransition(async () => {
            const res = await action(Number(quantite))
            if ('error' in res) setErreur(res.error)
          })
        }}
      >
        {pending ? '…' : t('Confirmer la sortie du lot')}
      </Button>
      {erreur && <span role="alert" className="w-full text-xs text-danger">{t(erreur)}</span>}
    </div>
  )
}
