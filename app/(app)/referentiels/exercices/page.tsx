import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { formatDate } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { LigneActions } from '@/components/LigneActions'
import { deleteExercice, updateExercice } from '../edition'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addExercice } from '../actions'

export default async function ExercicesPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: exercices } = await supabase
    .from('exercices_comptables')
    .select('*')
    .order('date_debut', { ascending: false })
  const peutModifier = ctx.role === 'admin'
  const peutEcrire = peutMenu(ctx, '/referentiels/exercices', ['admin', 'comptable'])

  return (
    <>
      <PageHeader
        titre={t('Exercices comptables')}
        description={t('Aucune écriture ne peut être saisie hors d’un exercice ouvert.')}
      >
        <SimpleCreateForm
          titre={t('Nouvel exercice')}
          disabled={!peutEcrire}
          action={addExercice}
          champs={[
            { name: 'libelle', label: t('Libellé'), required: true, placeholder: t('ex. Exercice 2026') },
            { name: 'date_debut', label: t('Début'), type: 'date', required: true },
            { name: 'date_fin', label: t('Fin'), type: 'date', required: true },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Libellé')}</th>
            <th className={th}>{t('Début')}</th>
            <th className={th}>{t('Fin')}</th>
            <th className={th}>{t('Statut')}</th>
            {peutModifier && <th className={th}></th>}
          </tr>
        </thead>
        <tbody>
          {exercices?.map((e) => (
            <tr key={e.id}>
              <td className={td}>{e.libelle}</td>
              <td className={td}>{formatDate(e.date_debut, ctx.lang)}</td>
              <td className={td}>{formatDate(e.date_fin, ctx.lang)}</td>
              <td className={td}>{e.statut === 'ouvert' ? t('Ouvert') : t('Clôturé')}</td>
                {peutModifier && (
                  <td className={td}>
                    <LigneActions
                      libelle={e.libelle}
                      confirmation={t('Supprimer « {nom} » ? Cette action est définitive.', { nom: e.libelle })}
                      modifier={updateExercice.bind(null, e.id)}
                      supprimer={deleteExercice.bind(null, e.id)}
                      champs={[
                        { name: 'libelle', label: t('Libellé'), required: true, defaultValue: e.libelle },
                        { name: 'date_debut', label: t('Début'), type: 'date', required: true, defaultValue: e.date_debut },
                        { name: 'date_fin', label: t('Fin'), type: 'date', required: true, defaultValue: e.date_fin },
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
