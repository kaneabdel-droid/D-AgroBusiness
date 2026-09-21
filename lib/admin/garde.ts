import { getLocalUser, getSharedAdminUser } from '@/utils/supabase/admin-identity'
import { isAdminEmail } from '@/lib/admin/auth'

/** Vérifie côté serveur qu'un administrateur de la plateforme est connecté (identité partagée, puis session locale). */
export async function adminConnecte() {
  const [partage, local] = await Promise.all([getSharedAdminUser(), getLocalUser()])
  if (isAdminEmail(partage?.email)) return partage
  if (isAdminEmail(local?.email)) return local
  return null
}

/** Message d'erreur à renvoyer par les server actions quand l'appelant n'est pas administrateur. */
export async function refuserSiNonAdmin(): Promise<string | null> {
  return (await adminConnecte()) ? null : 'Non autorisé'
}
