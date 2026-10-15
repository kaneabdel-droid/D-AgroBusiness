'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { useT } from '@/components/I18nProvider'
import { modifierEntreprise } from './actions'

export type InfosEntreprise = {
  nom: string
  nif: string
  rccm: string
  adresse: string
  telephone: string
  email: string
}

export function EntrepriseForm({ infos, modifiable, menuLayout = 'sidebar' }: { infos: InfosEntreprise; modifiable: boolean; menuLayout?: 'sidebar' | 'horizontal' }) {
  const { t } = useT()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'ok' | 'erreur'; texte: string } | null>(null)

  function onSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const res = await modifierEntreprise(formData)
      setMessage('error' in res ? { type: 'erreur', texte: res.error } : { type: 'ok', texte: 'Informations enregistrées.' })
    })
  }

  const champ = (name: keyof InfosEntreprise, label: string, opts: { type?: string; required?: boolean; pleineLargeur?: boolean } = {}) => (
    <div className={'space-y-1.5' + (opts.pleineLargeur ? ' sm:col-span-2' : '')}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={opts.type ?? 'text'} required={opts.required} defaultValue={infos[name]} disabled={!modifiable} />
    </div>
  )

  return (
    <Card className="max-w-3xl">
      <form action={onSubmit} className="grid gap-4 sm:grid-cols-2">
        {champ('nom', t('Nom de l’entreprise'), { required: true, pleineLargeur: true })}
        {champ('nif', t('Identification fiscale (NIF, NINEA)'))}
        {champ('rccm', t('Registre du commerce (RCCM)'))}
        {champ('adresse', t('Adresse'), { pleineLargeur: true })}
        {champ('telephone', t('Téléphone'), { type: 'tel' })}
        {champ('email', t('Email'), { type: 'email' })}

        <div className="space-y-1.5 sm:col-span-2 pt-3 border-t border-surface-border">
          <Label htmlFor="menu_layout">{t('Disposition du menu')}</Label>
          <select
            id="menu_layout"
            name="menu_layout"
            defaultValue={menuLayout}
            disabled={!modifiable}
            className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="sidebar">{t('Barre latérale classique (à gauche)')}</option>
            <option value="horizontal">{t('Affichage horizontal en haut de page')}</option>
          </select>
          <p className="text-xs text-foreground-muted">
            {t('Choisissez comment vos collaborateurs et vous visualisez la navigation de l’application.')}
          </p>
        </div>

        {message && (
          <p role={message.type === 'erreur' ? 'alert' : 'status'} className={'text-sm sm:col-span-2 ' + (message.type === 'erreur' ? 'text-danger' : 'text-success')}>
            {t(message.texte)}
          </p>
        )}
        {modifiable && (
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? t('Enregistrement…') : t('Enregistrer')}</Button>
          </div>
        )}
      </form>
    </Card>
  )
}
