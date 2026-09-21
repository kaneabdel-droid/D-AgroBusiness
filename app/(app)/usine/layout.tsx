import { redirect } from 'next/navigation'
import { getContexte } from '@/lib/session'

/** L'usine de transformation (nomenclatures, ordres de fabrication) exige le niveau Medium ou Premium. */
export default async function UsineLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexte()
  if (!ctx.accesUsine) redirect('/abonnement?requis=medium')
  return children
}
