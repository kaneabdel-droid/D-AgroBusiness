import { redirect } from 'next/navigation'
import { LayoutDashboard, Building2, CreditCard, Settings, LogOut } from 'lucide-react'
import { adminConnecte } from '@/lib/admin/garde'
import { creerT } from '@/lib/i18n'
import { langueNavigateur } from '@/lib/i18n-server'
import { I18nProvider } from '@/components/I18nProvider'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

// Défense en profondeur : le proxy bloque déjà /admin aux non-administrateurs, on re-vérifie ici.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await adminConnecte()
  if (!user) redirect('/admin/login')
  const lang = await langueNavigateur()
  const t = creerT(lang)

  const navItems = [
    { href: '/admin', label: t('Tableau de bord'), icon: LayoutDashboard },
    { href: '/admin/entreprises', label: t('Entreprises'), icon: Building2 },
    { href: '/admin/paiements', label: t('Paiements'), icon: CreditCard },
    { href: '/admin/config', label: t('Configuration'), icon: Settings },
  ]

  return (
    <I18nProvider lang={lang}>
      <div className="flex min-h-screen flex-col bg-surface lg:flex-row">
        <aside className="shrink-0 border-b border-surface-border bg-background lg:w-64 lg:border-b-0 lg:border-e">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 lg:block lg:p-6">
            <div>
              <p className="font-heading text-lg font-bold">D-AGROBUSINESS {t('Admin')}</p>
              <p className="mt-1 break-all text-xs text-foreground-muted">{user.email}</p>
            </div>
            <LanguageSwitcher lang={lang} className="lg:mt-3" />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:space-y-1 lg:overflow-visible lg:p-4">
            {navItems.map(({ href, label, icon: Icon }) => (
              <a key={href} href={href} className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-surface">
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </a>
            ))}
            <a href="/admin/logout" className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-foreground-muted transition-colors hover:bg-surface lg:mt-4">
              <LogOut className="h-4 w-4" aria-hidden />
              {t('Déconnexion')}
            </a>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </I18nProvider>
  )
}
