import { AppShell } from '@/components/AppShell'
import { getContexte } from '@/lib/session'
import { ROLES } from '@/lib/pays'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexte()
  return (
    <AppShell
      organisation={ctx.organisationNom}
      utilisateur={ctx.nomComplet ?? ctx.email ?? 'Utilisateur'}
      role={ROLES[ctx.role] ?? ctx.role}
    >
      {children}
    </AppShell>
  )
}
