'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/components/I18nProvider'
import { supprimerOrganisation } from './actions'

/** Zone dangereuse : suppression définitive, confirmée en recopiant le nom de l'entreprise. */
export function SupprimerOrganisation({ organisationId, nom }: { organisationId: string; nom: string }) {
  const { t } = useT()
  const router = useRouter()
  const [saisie, setSaisie] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const confirme = saisie.trim() === nom.trim()

  function supprimer() {
    if (!confirme) return
    if (!window.confirm(t('Dernière confirmation : supprimer définitivement « {nom} » et toutes ses données ? Cette action est irréversible.', { nom }))) return
    setErreur(null)
    startTransition(async () => {
      const res = await supprimerOrganisation(organisationId)
      if ('error' in res) setErreur(t(res.error))
      else {
        router.push('/admin/entreprises')
        router.refresh()
      }
    })
  }

  return (
    <div className="mt-8 rounded-xl border border-danger/30 bg-danger/5 p-5">
      <h2 className="mb-2 flex items-center gap-2 font-semibold text-danger">
        <AlertTriangle className="h-4 w-4" aria-hidden /> {t('Zone dangereuse')}
      </h2>
      <p className="mb-4 text-sm text-foreground-muted">
        {t('Supprime définitivement cette entreprise, ses comptes utilisateurs, sa comptabilité, ses paiements et toutes ses données. Aucune annulation possible.')}
      </p>
      <label htmlFor="confirmation-suppression" className="mb-1.5 block text-sm">
        {t('Recopiez le nom de l’entreprise pour confirmer :')} <span className="font-mono font-semibold">{nom}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Input id="confirmation-suppression" value={saisie} onChange={(e) => setSaisie(e.target.value)} disabled={pending} className="max-w-xs" autoComplete="off" />
        <Button type="button" variant="danger" onClick={supprimer} disabled={!confirme || pending}>
          {pending ? t('Suppression…') : t('Supprimer définitivement')}
        </Button>
      </div>
      {erreur && <p role="alert" className="mt-3 text-sm text-danger">{erreur}</p>}
    </div>
  )
}
