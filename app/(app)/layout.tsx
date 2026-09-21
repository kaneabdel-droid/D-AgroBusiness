import { AppShell } from '@/components/AppShell'
import { I18nProvider } from '@/components/I18nProvider'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { ROLES } from '@/lib/pays'
import { BandeauAbonnement } from '@/components/BandeauAbonnement'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  return (
    <I18nProvider lang={ctx.lang}>
      <AppShell
        organisation={ctx.organisationNom}
        utilisateur={ctx.nomComplet ?? ctx.email ?? t('Utilisateur')}
        role={t(ROLES[ctx.role] ?? ctx.role)}
        accesRh={ctx.accesRh}
        accesUsine={ctx.accesUsine}
      >
        <BandeauAbonnement etat={ctx.abonnement} lang={ctx.lang} />
        {children}
      </AppShell>
    </I18nProvider>
  )
}
