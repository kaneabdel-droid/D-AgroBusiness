'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { withRetry } from '@/utils/supabase/retry'

// Comptes de démonstration publics (entreprise « Riz du Delta », voir scripts/seed-demo.mjs) : un par rôle.
// Même mécanisme que les autres produits DembaSolution : generateLink() + verifyOtp() exécutés côté serveur avec la clé de
// service, aucun mot de passe n'est transmis au visiteur, et chaque clic ouvre sa propre session.
const COMPTES_DEMO = {
  direction: 'direction@demo-agro.dembasolution.com',
  comptable: 'comptable@demo-agro.dembasolution.com',
  rh: 'rh@demo-agro.dembasolution.com',
} as const

const echec: () => never = () => redirect('/decouvrir-dagrobusiness?demo_error=1')

export async function connexionDemo(formData: FormData) {
  const role = String(formData.get('role') ?? '') as keyof typeof COMPTES_DEMO
  const email = COMPTES_DEMO[role]
  if (!email) echec()

  const admin = createAdminClient()
  const { data, error } = await withRetry(() => admin.auth.admin.generateLink({ type: 'magiclink', email })).catch((e) => ({ data: null, error: e }))
  const jeton = data?.properties?.hashed_token
  if (error || !jeton) {
    console.error('Erreur génération du lien de démonstration :', error)
    echec()
  }

  const supabase = await createClient()
  const { error: erreurVerification } = await withRetry(() =>
    supabase.auth.verifyOtp({ token_hash: jeton, type: 'magiclink' })
  ).catch((e) => ({ error: e }))
  if (erreurVerification) {
    console.error('Erreur de connexion à la démonstration :', erreurVerification)
    echec()
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
