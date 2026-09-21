'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/components/I18nProvider'
import { DUREES, NIVEAUX, montantAbonnement, type Niveau } from '@/lib/abonnement'

type Resultat = { success: true } | { error: string }

/** Un produit Chariow par niveau et par durée : Chariow débite le prix du produit, qui doit être égal au montant indiqué. */
export function ChariowProduitsEditor({
  produits,
  action,
}: {
  produits: { niveau: string; mois: number; product_id: string }[]
  action: (niveau: string, mois: number, productId: string) => Promise<Resultat>
}) {
  const { t } = useT()
  const [valeurs, setValeurs] = useState<Record<string, string>>(() => Object.fromEntries(produits.map((p) => [`${p.niveau}_${p.mois}`, p.product_id])))
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const fcfa = (v: number) => `${v.toLocaleString('fr-FR').replace(/[  ]/g, ' ')} F CFA`

  function enregistrer(niveau: Niveau, mois: number) {
    setMessage(null)
    startTransition(async () => {
      const res = await action(niveau, mois, valeurs[`${niveau}_${mois}`] ?? '')
      setMessage('error' in res ? t(res.error) : t('Enregistré'))
    })
  }

  return (
    <div>
      {message && <p role="status" className="mb-3 text-sm">{message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-start text-foreground-muted">
            <tr><th className="py-2 text-start font-medium">{t('Niveau')}</th><th className="py-2 text-start font-medium">{t('Durée')}</th><th className="py-2 text-start font-medium">{t('Prix')}</th><th className="py-2 text-start font-medium">{t('Identifiant du produit Chariow')}</th><th /></tr>
          </thead>
          <tbody>
            {(Object.keys(NIVEAUX) as Niveau[]).flatMap((n) =>
              DUREES.map((m) => (
                <tr key={`${n}_${m}`} className="border-t border-surface-border">
                  <td className="py-2">{t(NIVEAUX[n].nom)}</td>
                  <td className="py-2">{t('{n} mois', { n: m })}</td>
                  <td className="py-2 tabular-nums text-foreground-muted">{fcfa(montantAbonnement(n, m))}</td>
                  <td className="py-2 pe-2">
                    <Input value={valeurs[`${n}_${m}`] ?? ''} onChange={(e) => setValeurs((v) => ({ ...v, [`${n}_${m}`]: e.target.value }))} placeholder="prod_…" disabled={pending} className="h-9 font-mono text-xs" />
                  </td>
                  <td className="py-2"><Button type="button" size="sm" disabled={pending} onClick={() => enregistrer(n, m)}>{t('Enregistrer')}</Button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
