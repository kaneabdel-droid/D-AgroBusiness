'use client'

import { useState, useEffect, useTransition } from 'react'
import { Wifi, WifiOff, CheckCircle2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import PasswordInput from '@/components/PasswordInput'
import { Label } from '@/components/ui/label'
import { PAYS } from '@/lib/pays'
import { creerT, type Lang } from '@/lib/i18n'
import { signIn, signUp, type LoginActionResult } from '@/app/auth/actions'
import {
  cacheOfflineAccount,
  verifyOfflineCredentials,
  getOfflineSession,
} from '@/lib/offline/offline-auth'

export function AuthForm({ mode, lang = 'fr', suite }: { mode: 'login' | 'signup'; lang?: Lang; suite?: string | null }) {
  const t = creerT(lang)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (mode === 'login') {
      const activeSession = getOfflineSession()
      if (activeSession && !navigator.onLine) {
        setSuccessNotice(
          t('Session locale active pour') + ' ' + (activeSession.user.nomComplet || activeSession.user.identifiant) + '.'
        )
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [mode, t])

  function onSubmit(formData: FormData) {
    setMessage(null)
    setSuccessNotice(null)

    if (mode === 'signup') {
      startTransition(async () => {
        const res = await signUp(formData)
        if (res && 'error' in res && res.error) setMessage({ type: 'error', text: t(res.error) })
        if (res && 'success' in res && res.success) setMessage({ type: 'success', text: res.success })
      })
      return
    }

    // MODE LOGIN
    const cleanIdentifier = (identifier || String(formData.get('email') ?? formData.get('identifier') ?? '')).trim()
    const pwd = password || String(formData.get('password') ?? '')

    if (!cleanIdentifier || !pwd) {
      setMessage({ type: 'error', text: t('Veuillez renseigner votre identifiant et votre mot de passe.') })
      return
    }

    // 1. CAS HORS-LIGNE DIRECT (Sans connexion réseau)
    if (!isOnline || !navigator.onLine) {
      startTransition(async () => {
        const offRes = await verifyOfflineCredentials(cleanIdentifier, pwd)
        if (offRes.success && offRes.session) {
          document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
          if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SET_OFFLINE_SESSION', active: true })
          }
          setSuccessNotice(t('Connexion locale validée ! Accès à votre espace D-AGROBUSINESS hors-ligne...'))
          setTimeout(() => {
            window.location.href = suite || '/'
          }, 400)
        } else {
          setMessage({
            type: 'error',
            text: offRes.error || t('Identifiant ou mot de passe incorrect en mode hors-ligne.'),
          })
        }
      })
      return
    }

    // 2. CAS EN LIGNE AVEC REPLI AUTOMATIQUE HORS-LIGNE
    startTransition(async () => {
      try {
        const loginFormData = new FormData()
        loginFormData.set('identifier', cleanIdentifier)
        loginFormData.set('email', cleanIdentifier)
        loginFormData.set('password', pwd)
        if (suite) loginFormData.set('suite', suite)

        const res: LoginActionResult = await signIn(loginFormData)

        if (res.error) {
          if (
            res.error.toLowerCase().includes('fetch') ||
            res.error.toLowerCase().includes('réseau') ||
            res.error.toLowerCase().includes('network')
          ) {
            const offRes = await verifyOfflineCredentials(cleanIdentifier, pwd)
            if (offRes.success) {
              document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
              if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'SET_OFFLINE_SESSION', active: true })
              }
              setSuccessNotice(t('Réseau instable : connexion locale hors-ligne activée !'))
              setTimeout(() => {
                window.location.href = suite || '/'
              }, 400)
              return
            }
          }
          setMessage({ type: 'error', text: t(res.error) })
          return
        }

        if (res.success) {
          if (res.userContext) {
            try {
              await cacheOfflineAccount(cleanIdentifier, pwd, res.userContext)
            } catch (err) {
              console.warn('Erreur mise en cache hors-ligne D-AGROBUSINESS:', err)
            }
          }

          document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
          if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SET_OFFLINE_SESSION', active: true })
          }

          if ('caches' in window) {
            try {
              const cache = await caches.open('demba-offline-dagro-v4')
              const appRes = await fetch('/')
              if (appRes && appRes.ok) {
                await cache.put('/', appRes)
              }
            } catch (cacheErr) {
              console.warn('Erreur pré-mise en cache app shell:', cacheErr)
            }
          }

          setSuccessNotice(res.success)
          window.location.href = res.redirectUrl || suite || '/'
        }
      } catch (err: any) {
        const offRes = await verifyOfflineCredentials(cleanIdentifier, pwd)
        if (offRes.success) {
          document.cookie = 'demba_offline_active=1; path=/; max-age=2592000; SameSite=Lax'
          setSuccessNotice(t('Connexion hors-ligne de secours validée !'))
          setTimeout(() => {
            window.location.href = suite || '/'
          }, 600)
        } else {
          setMessage({
            type: 'error',
            text: t('Impossible de joindre le serveur et aucun compte hors-ligne synchronisé trouvé. Vérifiez votre connexion Internet.'),
          })
        }
      }
    })
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {suite && <input type="hidden" name="suite" value={suite} />}

      {/* Alerte Mode Réseau / Hors-ligne pour le login */}
      {mode === 'login' && !isOnline && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">{t('Mode hors-ligne direct actif')}</span>
            {t('Vous pouvez vous connecter avec vos identifiants mémorisés sur cet appareil. Vos opérations agro-industrielles seront synchronisées dès le retour d’Internet.')}
          </div>
        </div>
      )}

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
        <Label htmlFor="email">
          {mode === 'login' ? t('Identifiant, téléphone ou e-mail') : t('Email')}
        </Label>
        <Input
          id="email"
          name="email"
          type={mode === 'login' ? 'text' : 'email'}
          placeholder={mode === 'login' ? 'ex: chef_culture, 771234567 ou email@domaine.com' : undefined}
          required
          autoComplete={mode === 'login' ? 'username' : 'email'}
          value={mode === 'login' ? identifier : undefined}
          onChange={mode === 'login' ? (e) => setIdentifier(e.target.value) : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">{t('Mot de passe')}</Label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={mode === 'signup' ? 8 : undefined}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={mode === 'login' ? password : undefined}
          onChange={mode === 'login' ? (e) => setPassword(e.target.value) : undefined}
        />
      </div>

      {message && (
        <p
          role="alert"
          className={message.type === 'error' ? 'text-sm text-danger font-medium' : 'text-sm text-success font-medium'}
        >
          {message.text}
        </p>
      )}

      {successNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm font-medium flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t('Patientez…') : mode === 'login' ? t('Se connecter') : t('Créer mon compte')}
      </Button>

      {mode === 'login' && (
        isOnline ? (
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-foreground-muted pt-1">
            <Wifi className="h-3 w-3 text-emerald-500" />
            <span>{t('Connecté au serveur en ligne (synchronisation activée)')}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 pt-1">
            <ShieldCheck className="h-3 w-3" />
            <span>{t('Authentification locale autonome sans réseau')}</span>
          </div>
        )
      )}
    </form>
  )
}
