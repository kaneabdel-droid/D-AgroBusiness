import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { formatMontant } from '@/lib/utils'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addCategorieSalariale } from '../actions'

export default async function CategoriesSalarialesPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const fm = (v: number | string | null) => formatMontant(v, ctx.devise, ctx.lang)
  const supabase = await createClient()
  const { data: categories } = await supabase.from('categories_salariales').select('*').order('ordre').order('code')
  const peutEcrire = peutMenu(ctx, '/rh/categories', ['admin', 'rh'])

  return (
    <>
      <PageHeader
        titre={t('Catégories salariales')}
        description={t('Grille de salaire de base par catégorie professionnelle : chaque contrat peut s’y rattacher, ce qui donne le salaire de base et le salaire horaire (heures supplémentaires, prime d’ancienneté). Laissez le salaire horaire vide pour un calcul automatique (salaire de base ÷ heures normales du mois, réglées dans Paie → Paramètres).')}
      >
        <SimpleCreateForm
          titre={t('Nouvelle catégorie')}
          disabled={!peutEcrire}
          action={addCategorieSalariale}
          champs={[
            { name: 'code', label: t('Code'), required: true, placeholder: t('ex. CAT1') },
            { name: 'libelle', label: t('Libellé'), required: true },
            { name: 'salaire_base', label: t('Salaire de base mensuel'), type: 'number', step: '0.01', required: true },
            { name: 'salaire_horaire', label: t('Salaire horaire (vide : calcul automatique)'), type: 'number', step: '0.01' },
            { name: 'ordre', label: t('Ordre d’affichage'), type: 'number', defaultValue: '10' },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Code')}</th>
            <th className={th}>{t('Libellé')}</th>
            <th className={`${th} text-right`}>{t('Salaire de base')}</th>
            <th className={`${th} text-right`}>{t('Salaire horaire')}</th>
          </tr>
        </thead>
        <tbody>
          {categories?.map((c) => (
            <tr key={c.id}>
              <td className={td}>{c.code}</td>
              <td className={td}>{c.libelle}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(c.salaire_base)}</td>
              <td className={`${td} text-right tabular-nums`}>{fm(c.salaire_horaire)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
