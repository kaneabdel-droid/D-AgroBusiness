'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PAYS } from '@/lib/pays'
import { creerT, type Lang } from '@/lib/i18n'
import { signIn, signUp } from '@/app/auth/actions'

export function AuthForm({ mode, lang = 'fr' }: { mode: 'login' | 'signup'; lang?: Lang }) {
  const t = creerT(lang)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(formData: FormData) {
    setMessage(null)
    startTransition(async () => {
      const res = await (mode === 'login' ? signIn(formData) : signUp(formData))
      if (res && 'error' in res && res.error) setMessage({ type: 'error', text: t(res.error) })
      if (res && 'success' in res && res.success) setMessage({ type: 'success', text: res.success })
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {mode === 'signup' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="organisation">{t('Nom de l’entreprise (laisser vide si vous avez été invité)')}</Label>
            <Input id="organisation" name="organisation" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nom_complet">{t('Votre nom complet')}</Label>
            <Input id="nom_complet" name="nom_complet" required autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pays">{t('Pays')}</Label>
            <Select id="pays" name="pays" defaultValue="SN">
              {PAYS.map((p) => (
                <option key={p.code} value={p.code}>
                  {t(p.nom)}
                </option>
              ))}
            </Select>
          </div>
        </>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('Email')}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t('Mot de passe')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={mode === 'signup' ? 8 : undefined}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </div>
      {message && (
        <p
          role="alert"
          className={message.type === 'error' ? 'text-sm text-danger' : 'text-sm text-success'}
        >
          {message.text}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t('Patientez…') : mode === 'login' ? t('Se connecter') : t('Créer mon compte')}
      </Button>
    </form>
  )
}
