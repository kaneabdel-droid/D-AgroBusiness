'use client'

import { useState, useTransition } from 'react'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { contrepasserEcriture } from '@/app/(app)/comptabilite/actions'
import { useT } from '@/components/I18nProvider'

export function ContrepassationButton({ id }: { id: string }) {
  const { t } = useT()
  const [pending, startTransition] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  function onClick() {
    const motif = window.prompt(t('Motif de la contre-passation :'))
    if (motif === null) return
    startTransition(async () => {
      const res = await contrepasserEcriture(id, motif)
      setErreur('error' in res ? res.error : null)
    })
  }

  return (
    <span className="inline-flex flex-col items-start">
      <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={pending}>
        <Undo2 className="h-3.5 w-3.5" aria-hidden /> {t('Contre-passer')}
      </Button>
      {erreur && <span role="alert" className="mt-1 text-xs text-danger">{t(erreur)}</span>}
    </span>
  )
}
