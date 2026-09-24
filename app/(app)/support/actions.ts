'use server'

import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { transfererAuSupport, SUJET_MAX, MESSAGE_MAX } from '@/lib/support/transferer'

export async function envoyerMessageSupport(formData: FormData): Promise<{ success?: true; error?: string }> {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)

  const sujet = String(formData.get('sujet') || '').trim()
  const message = String(formData.get('message') || '').trim()

  if (!sujet || !message) return { error: t('Veuillez remplir tous les champs.') }
  if (sujet.length > SUJET_MAX || message.length > MESSAGE_MAX) {
    return { error: t('Le sujet (200 caractères max) ou le message (5000 caractères max) est trop long.') }
  }
  if (!ctx.email) return { error: t('Votre session a expiré. Veuillez vous reconnecter.') }

  const emailEnvoye = await transfererAuSupport({
    produit: 'D-AGROBUSINESS',
    email: ctx.email,
    organisation: ctx.organisationNom,
    sujet,
    message,
  })

  const supabase = await createClient()
  const { error: insertError } = await supabase.from('support_messages').insert({
    organisation_id: ctx.organisationId,
    user_id: ctx.userId,
    email: ctx.email,
    sujet,
    message,
    email_envoye: emailEnvoye,
  })
  if (insertError) console.error('Enregistrement message support échoué', insertError)

  // Échec seulement si la demande n'a été ni transmise ni enregistrée.
  if (!emailEnvoye && insertError) {
    return { error: t('Le message n’a pas pu être envoyé. Réessayez ou écrivez-nous à support@dembasolution.com.') }
  }

  return { success: true }
}
