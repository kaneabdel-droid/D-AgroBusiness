import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/components/I18nProvider'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { ROLES } from '@/lib/pays'
import { BandeauAbonnement } from '@/components/BandeauAbonnement'
import { abonnementActif } from '@/lib/abonnement'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexte()
  // Essai terminé sans paiement, ou compte verrouillé : seule la page Abonnement (paiement) reste accessible.
  const chemin = (await headers()).get('x-pathname') ?? ''
  if (!abonnementActif(ctx.abonnement) && !chemin.startsWith('/abonnement')) redirect('/abonnement?expire=1')
  const t = creerT(ctx.lang)
  return (
    <I18nProvider lang={ctx.lang}>
      <AppShell
        organisation={ctx.organisationNom}
        utilisateur={ctx.nomComplet ?? ctx.email ?? t('Utilisateur')}
        role={t(ROLES[ctx.role] ?? ctx.role)}
        roleCle={ctx.role}
        permissions={ctx.permissions}
        accesRh={ctx.accesRh}
        accesUsine={ctx.accesUsine}
      >
        <BandeauAbonnement etat={ctx.abonnement} lang={ctx.lang} />
        {children}
      </AppShell>
    </I18nProvider>
  )
}
