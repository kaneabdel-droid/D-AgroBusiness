'use client'

import { useState, useTransition } from 'react'
import { Pencil, Power, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChampFormulaire, type Champ } from '@/components/SimpleCreateForm'
import { useT } from '@/components/I18nProvider'

type Resultat = { success: true } | { error: string }

/** Boutons Modifier / Supprimer d'une ligne de référentiel (réservés à l'administrateur de l'organisation). */
export function LigneActions({
  libelle,
  champs,
  modifier,
  supprimer,
  confirmation,
  actif,
  basculerActif,
  confirmationActif,
}: {
  libelle: string
  champs: Champ[]
  modifier: (formData: FormData) => Promise<Resultat>
  supprimer: () => Promise<Resultat>
  confirmation: string
  /** Départements et secteurs : état actuel et action pour masquer / réafficher l'élément dans les listes de choix. */
  actif?: boolean
  basculerActif?: () => Promise<Resultat>
  confirmationActif?: string
}) {
  const { t } = useT()
  const [ouvert, setOuvert] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [erreurSuppression, setErreurSuppression] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function ouvrir() {
    setErreur(null)
    setErreurSuppression(null)
    setOuvert(true)
  }

  function onModifier(formData: FormData) {
    setErreur(null)
    startTransition(async () => {
      const res = await modifier(formData)
      if ('error' in res) setErreur(res.error)
      else setOuvert(false)
    })
  }

  function onBasculer() {
    if (actif !== false && confirmationActif && !window.confirm(confirmationActif)) return
    setErreurSuppression(null)
    startTransition(async () => {
      const res = await basculerActif!()
      if ('error' in res) setErreurSuppression(res.error)
    })
  }

  function onSupprimer() {
    if (!window.confirm(confirmation)) return
    setErreurSuppression(null)
    startTransition(async () => {
      const res = await supprimer()
      if ('error' in res) setErreurSuppression(res.error)
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
      <Button type="button" size="sm" variant="outline" className="px-2" onClick={ouvrir} disabled={pending} title={t('Modifier')} aria-label={`${t('Modifier')} ${libelle}`}>
        <Pencil className="h-4 w-4" aria-hidden />
      </Button>
      {basculerActif && (
        <Button type="button" size="sm" variant="outline" className="px-2" onClick={onBasculer} disabled={pending} title={actif === false ? t('Réactiver') : t('Désactiver')} aria-label={`${actif === false ? t('Réactiver') : t('Désactiver')} ${libelle}`}>
          <Power className="h-4 w-4" aria-hidden />
        </Button>
      )}
      <Button type="button" size="sm" variant="outline" className="px-2" onClick={onSupprimer} disabled={pending} title={t('Supprimer')} aria-label={`${t('Supprimer')} ${libelle}`}>
        <Trash2 className="h-4 w-4" aria-hidden />
      </Button>
      </div>
      {erreurSuppression && <p role="alert" className="max-w-xs text-end text-xs text-danger">{t(erreurSuppression)}</p>}

      {ouvert && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <Card className="w-full max-w-2xl text-start">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold">{t('Modifier')} — {libelle}</h2>
              <button type="button" onClick={() => setOuvert(false)} aria-label={t('Fermer')} className="rounded-lg p-2 hover:bg-sidebar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form action={onModifier} className="grid gap-4 sm:grid-cols-2">
              {champs.map((c) => <ChampFormulaire key={c.name} champ={c} />)}
              {erreur && (
                <p role="alert" className="text-sm text-danger sm:col-span-2">
                  {t(erreur)}
                </p>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {pending ? t('Enregistrement…') : t('Enregistrer')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOuvert(false)}>
                  {t('Annuler')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
