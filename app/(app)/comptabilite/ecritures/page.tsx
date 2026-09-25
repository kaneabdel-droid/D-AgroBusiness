import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { getContexte } from '@/lib/session'
import { peutMenu } from '@/lib/permissions'
import { creerT } from '@/lib/i18n'
import { formatDate, formatMontant } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PageHeader, TableWrap, th, td } from '@/components/ui/card'
import { ContrepassationButton } from '@/components/ContrepassationButton'

type Ligne = { debit: number; credit: number; tiers_id: string | null }

export default async function EcrituresPage() {
  const ctx = await getContexte()
  const t = creerT(ctx.lang)
  const supabase = await createClient()
  const { data: ecritures } = await supabase
    .from('ecritures')
    .select('id, numero, date_ecriture, libelle, reference_piece, contrepassation_de, journaux(code), lignes_ecritures(debit, credit, tiers_id)')
    .order('date_ecriture', { ascending: false })
    .order('numero', { ascending: false })
    .limit(100)

  const contrepassees = new Set(
    (ecritures ?? []).map((e) => e.contrepassation_de).filter((v): v is string => !!v)
  )
  const peutEcrire = peutMenu(ctx, '/comptabilite/ecritures', ['admin', 'comptable'])

  return (
    <>
      <PageHeader
        titre={t('Écritures comptables')}
        description={t('Les écritures validées sont immuables : toute correction passe par une contre-passation.')}
      >
        {peutEcrire && (
          <Button asChild>
            <Link href="/comptabilite/ecritures/nouvelle">
              <Plus className="h-4 w-4" aria-hidden /> {t('Nouvelle écriture')}
            </Link>
          </Button>
        )}
      </PageHeader>
      <TableWrap>
        <thead>
          <tr>
            <th className={th}>{t('Date')}</th>
            <th className={th}>{t('Journal')}</th>
            <th className={th}>N°</th>
            <th className={th}>{t('Libellé')}</th>
            <th className={`${th} text-right`}>{t('Montant')}</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {ecritures?.map((e) => {
            const journal = Array.isArray(e.journaux) ? e.journaux[0] : e.journaux
            // Le montant affiché est celui de la facture/du mouvement lié au tiers (client/fournisseur),
            // pas la somme de tous les débits : une vente de stock combine dans la même écriture la vente
            // elle-même et la sortie de stock à son coût (cf. enregistrer_vente()), et sommer tous les
            // débits gonflerait le montant affiché avec ce coût de sortie, sans rapport avec le montant
            // de la facture tel qu'il apparaît dans le journal des ventes/achats.
            const lignes = e.lignes_ecritures as Ligne[]
            const lignesTiers = lignes.filter((l) => l.tiers_id)
            const montant =
              lignesTiers.length > 0
                ? lignesTiers.reduce((s, l) => s + Number(l.debit) + Number(l.credit), 0)
                : lignes.reduce((s, l) => s + Number(l.debit), 0)
            const estContrepassation = !!e.contrepassation_de
            const dejaContrepassee = contrepassees.has(e.id)
            return (
              <tr key={e.id}>
                <td className={td}>{formatDate(e.date_ecriture, ctx.lang)}</td>
                <td className={td}>{journal?.code}</td>
                <td className={td}>{e.numero}</td>
                <td className={td}>
                  {e.libelle}
                  {estContrepassation && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-xs">{t('contre-passation')}</span>}
                  {dejaContrepassee && <span className="ml-2 rounded bg-sidebar px-1.5 py-0.5 text-xs">{t('contre-passée')}</span>}
                </td>
                <td className={`${td} text-right tabular-nums`}>{formatMontant(montant, ctx.devise, ctx.lang)}</td>
                <td className={td}>
                  {peutEcrire && !estContrepassation && !dejaContrepassee && <ContrepassationButton id={e.id} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </TableWrap>
    </>
  )
}
