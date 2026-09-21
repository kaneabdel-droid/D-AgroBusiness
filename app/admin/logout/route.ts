import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminIdentityClient } from '@/utils/supabase/admin-identity'

// Déconnexion de l'identité admin partagée (tous les produits DembaSolution) et de la session locale éventuelle.
export async function GET(request: Request) {
  try {
    await (await createAdminIdentityClient()).auth.signOut()
  } catch {
    // identité partagée non configurée : rien à fermer
  }
  await (await createClient()).auth.signOut()
  return NextResponse.redirect(new URL('/admin/login', request.url))
}
