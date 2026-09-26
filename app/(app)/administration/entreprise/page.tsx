import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { creerT } from '@/lib/i18n'
import { PageHeader, Card } from '@/components/ui/card'
import { EntrepriseForm } from './EntrepriseForm'

export default async function EntreprisePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: org } = await supabase
    .from('organisations')
    .select('nom, nif, rccm, adresse, telephone, email, pays, devise, referentiel')
    .eq('id', ctx.organisationId)
    .single()

  const modifiable = ctx.role === 'admin'

  return (
    <>
      <PageHeader
        titre={t('Entreprise')}
        description={modifiable
          ? t('Les coordonnées de votre entreprise. Vous pouvez les mettre à jour à tout moment : le nom s’affiche partout dans l’application.')
          : t('Les coordonnées de votre entreprise. Seul l’administrateur peut les modifier.')}
      />
      <div className="space-y-6">
        <EntrepriseForm
          modifiable={modifiable}
          infos={{
            nom: org?.nom ?? '',
            nif: org?.nif ?? '',
            rccm: org?.rccm ?? '',
            adresse: org?.adresse ?? '',
            telephone: org?.telephone ?? '',
            email: org?.email ?? '',
          }}
        />
        <Card className="max-w-3xl">
          <h2 className="font-heading text-lg font-semibold">{t('Paramètres fixés à la création')}</h2>
          <p className="mt-1 text-sm text-foreground-muted">{t('Ils déterminent le plan comptable et les règles de paie : contactez l’assistance pour les changer.')}</p>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-foreground-muted">{t('Pays')}</dt><dd className="font-medium">{org?.pays}</dd></div>
            <div><dt className="text-foreground-muted">{t('Devise')}</dt><dd className="font-medium">{org?.devise}</dd></div>
            <div><dt className="text-foreground-muted">{t('Référentiel comptable')}</dt><dd className="font-medium">{org?.referentiel}</dd></div>
          </dl>
        </Card>
      </div>
    </>
  )
}
