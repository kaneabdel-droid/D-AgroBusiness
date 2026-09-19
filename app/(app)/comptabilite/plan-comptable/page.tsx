import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { SimpleCreateForm } from '@/components/SimpleCreateForm'
import { addCompte } from '../../referentiels/actions'

const CLASSES: Record<number, string> = {
  1: 'Ressources durables', 2: 'Actif immobilisé', 3: 'Stocks', 4: 'Tiers',
  5: 'Trésorerie', 6: 'Charges', 7: 'Produits', 8: 'Autres charges et produits',
}

export default async function PlanComptablePage() {
  const ctx = await getContexte()
  const supabase = await createClient()
  const { data: comptes } = await supabase
    .from('comptes_comptables')
    .select('id, numero, libelle, classe')
    .eq('actif', true)
    .order('numero')
  const peutEcrire = ['admin', 'comptable'].includes(ctx.role)

  return (
    <>
      <PageHeader
        titre="Plan comptable"
        description={`Référentiel ${ctx.referentiel}. Les comptes de classe 6 et 7 exigent une imputation par département.`}
      >
        <SimpleCreateForm
          titre="Nouveau compte"
          disabled={!peutEcrire}
          action={addCompte}
          champs={[
            { name: 'numero', label: 'Numéro', required: true, placeholder: 'ex. 60211' },
            { name: 'libelle', label: 'Libellé', required: true },
          ]}
        />
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>Numéro</th>
            <th className={th}>Libellé</th>
            <th className={th}>Classe</th>
          </tr>
        </thead>
        <tbody>
          {comptes?.map((c) => (
            <tr key={c.id}>
              <td className={td}>{c.numero}</td>
              <td className={td}>{c.libelle}</td>
              <td className={td}>{c.classe} — {CLASSES[c.classe] ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  )
}
