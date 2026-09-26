import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { LigneActions } from '@/components/LigneActions'
import { deleteCampagne, updateCampagne } from '../edition'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addCampagne } from '../actions'

export default async function CampagnesPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: campagnes } = await supabase
    .from('campagnes')
    .select('*')
    .order('date_debut', { ascending: false })
  const peutModifier = ctx.role === 'admin'
  const peutEcrire = peutMenu(ctx, '/referentiels/campagnes', ['admin', 'direction', 'comptable', 'chef_departement'])

  return (
    <>
      <PageHeader
        titre={t('Campagnes agricoles')}
        description={t('Troisième axe analytique : une campagne peut chevaucher deux exercices comptables.')}
      >
        <SimpleCreateForm
          titre={t('Nouvelle campagne')}
          disabled={!peutEcrire}
          action={addCampagne}
          champs={[
            { name: 'code', label: t('Code'), required: true, placeholder: t('ex. HIV-2026') },
            { name: 'libelle', label: t('Libellé'), required: true, placeholder: t('ex. Contre-saison chaude 2026') },
            { name: 'date_debut', label: t('Début'), type: 'date', required: true },
            { name: 'date_fin', label: t('Fin'), type: 'date', required: true },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Libellé')}</th>
            <th className={th}>{t('Début')}</th>
            <th className={th}>{t('Fin')}</th>
            <th className={th}>{t('Statut')}</th>
            {peutModifier && <th className={th}></th>}
          </tr>
        </thead>
        <tbody>
          {campagnes?.map((c) => (
            <tr key={c.id}>
              <td className={td}>{c.code}</td>
              <td className={td}>{c.libelle}</td>
              <td className={td}>{formatDate(c.date_debut, ctx.lang)}</td>
              <td className={td}>{formatDate(c.date_fin, ctx.lang)}</td>
              <td className={td}>{c.statut === 'ouverte' ? t('Ouverte') : t('Clôturée')}</td>
                {peutModifier && (
                  <td className={td}>
                    <LigneActions
                      libelle={c.libelle}
                      confirmation={t('Supprimer « {nom} » ? Cette action est définitive.', { nom: c.libelle })}
                      modifier={updateCampagne.bind(null, c.id)}
                      supprimer={deleteCampagne.bind(null, c.id)}
                      champs={[
                        { name: 'code', label: t('Code'), required: true, defaultValue: c.code },
                        { name: 'libelle', label: t('Libellé'), required: true, defaultValue: c.libelle },
                        { name: 'date_debut', label: t('Début'), type: 'date', required: true, defaultValue: c.date_debut },
                        { name: 'date_fin', label: t('Fin'), type: 'date', required: true, defaultValue: c.date_fin },
                      ]}
                    />
                  </td>
                )}
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
