import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addCompte } from '../../referentiels/actions'

const CLASSES: Record<number, string> = {
  1: 'Ressources durables', 2: 'Actif immobilisé', 3: 'Stocks', 4: 'Tiers',
  5: 'Trésorerie', 6: 'Charges', 7: 'Produits', 8: 'Autres charges et produits',
}

export default async function PlanComptablePage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: comptes } = await supabase
    .from('comptes_comptables')
    .select('id, numero, libelle, classe')
    .eq('actif', true)
    .order('numero')
  const peutEcrire = peutMenu(ctx, '/comptabilite/plan-comptable', ['admin', 'comptable'])

  return (
    <>
      <PageHeader
        titre={t('Plan comptable')}
        description={`${t('Référentiel')} ${ctx.referentiel}. ${t('Les comptes de classe 6 et 7 exigent une imputation par département.')}`}
      >
        <SimpleCreateForm
          titre={t('Nouveau compte')}
          disabled={!peutEcrire}
          action={addCompte}
          champs={[
            { name: 'numero', label: t('Numéro'), required: true, placeholder: t('ex. 60211') },
            { name: 'libelle', label: t('Libellé'), required: true },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Numéro')}</th>
            <th className={th}>{t('Libellé')}</th>
            <th className={th}>{t('Classe')}</th>
          </tr>
        </thead>
        <tbody>
          {comptes?.map((c) => (
            <tr key={c.id}>
              <td className={td}>{c.numero}</td>
              <td className={td}>{c.libelle}</td>
              <td className={td}>{c.classe} — {t(CLASSES[c.classe] ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
