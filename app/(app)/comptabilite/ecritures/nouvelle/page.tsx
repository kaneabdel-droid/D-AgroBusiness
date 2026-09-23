import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { PageHeader } from '@/components/ui/card'
import { EcritureForm } from '@/components/EcritureForm'

export default async function NouvelleEcriturePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  if (!peutMenu(ctx, '/comptabilite/ecritures', ['admin', 'comptable'])) redirect('/comptabilite/ecritures')

  const supabase = await createClient()
  const [journaux, comptes, tiers, departements, secteurs, campagnes] = await Promise.all([
    supabase.from('journaux').select('id, code, libelle').eq('actif', true).order('code'),
    supabase.from('comptes_comptables').select('id, numero, libelle, classe').eq('actif', true).order('numero'),
    supabase.from('tiers').select('id, code, nom').eq('actif', true).order('nom'),
    supabase.from('departements').select('id, nom').eq('actif', true).order('nom'),
    supabase.from('secteurs_projets').select('id, nom, departement_id').eq('actif', true).order('nom'),
    supabase.from('campagnes').select('id, code, libelle').eq('statut', 'ouverte').order('date_debut', { ascending: false }),
  ])

  return (
    <>
      <PageHeader
        titre={t('Nouvelle écriture')}
        description={t('Saisie équilibrée. Les charges et produits (classes 6 et 7) doivent être imputés à un département.')}
      />
      <EcritureForm
        devise={ctx.devise}
        journaux={(journaux.data ?? []).map((j) => ({ id: j.id, label: `${j.code} — ${t(j.libelle)}` }))}
        comptes={(comptes.data ?? []).map((c) => ({ id: c.id, label: `${c.numero} — ${c.libelle}`, classe: c.classe }))}
        tiers={(tiers.data ?? []).map((t) => ({ id: t.id, label: `${t.code} — ${t.nom}` }))}
        departements={(departements.data ?? []).map((d) => ({ id: d.id, label: d.nom }))}
        secteurs={(secteurs.data ?? []).map((s) => ({ id: s.id, label: s.nom, departement_id: s.departement_id }))}
        campagnes={(campagnes.data ?? []).map((c) => ({ id: c.id, label: `${c.code} — ${c.libelle}` }))}
      />
    </>
  )
}
