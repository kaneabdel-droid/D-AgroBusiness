import { redirect } from 'next/navigation'
import { getContexte } from '@/lib/session'

/** Les ressources humaines (personnel, pointage, congés, paie) sont réservées au niveau Premium. */
export default async function RhLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContexte()
  if (!ctx.accesRh) redirect('/abonnement?requis=premium')
  return children
}
