'use client'

import { Fragment, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/I18nProvider'
import type { ActionPermission, Matrice } from '@/lib/permissions'
import type { GroupeMenu } from '@/lib/menus'

type Resultat = { success: true } | { error: string }

const ACTIONS: { cle: ActionPermission; label: string }[] = [
  { cle: 'lire', label: 'Lecture' },
  { cle: 'ecrire', label: 'Écriture' },
  { cle: 'modifier', label: 'Modification' },
]

/** true = coché (autorisé), y compris quand rien n'est encore enregistré (comportement par défaut). */
function estAutorise(matrice: Matrice, href: string, role: string, action: ActionPermission): boolean {
  const v = matrice[href]?.[role]?.[action]
  return v !== false
}

export function PermissionsMatrixForm({
  groupes,
  roles,
  matriceInitiale,
  action,
}: {
  groupes: GroupeMenu[]
  roles: { valeur: string; label: string }[]
  matriceInitiale: Matrice
  action: (matrice: Matrice) => Promise<Resultat>
}) {
  const { t } = useT()
  const [matrice, setMatrice] = useState<Matrice>(matriceInitiale)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  function basculer(href: string, role: string, cle: ActionPermission) {
    setMatrice((m) => {
      const actuel = estAutorise(m, href, role, cle)
      return {
        ...m,
        [href]: {
          ...m[href],
          [role]: { ...m[href]?.[role], [cle]: !actuel },
        },
      }
    })
  }

  function toutAutoriser(role: string) {
    setMatrice((m) => {
      const suivant: Matrice = { ...m }
      for (const g of groupes) for (const i of g.items) {
        suivant[i.href] = { ...suivant[i.href], [role]: { lire: true, ecrire: true, modifier: true } }
      }
      return suivant
    })
  }

  function enregistrer() {
    setMessage(null)
    startTransition(async () => {
      const res = await action(matrice)
      if ('error' in res) setMessage({ ok: false, texte: res.error })
      else setMessage({ ok: true, texte: t('Permissions enregistrées.') })
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending} onClick={enregistrer}>
          {pending ? t('Enregistrement…') : t('Enregistrer les permissions')}
        </Button>
        {message && (
          <span role="status" className={`text-sm ${message.ok ? 'text-success' : 'text-danger'}`}>{message.texte}</span>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-surface-border">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-surface">
              <th className="sticky start-0 z-10 min-w-[220px] border-b border-e border-surface-border bg-surface px-3 py-2 text-start font-semibold">
                {t('Menu')}
              </th>
              {roles.map((r) => (
                <th key={r.valeur} className="border-b border-e border-surface-border px-2 py-2 text-center font-semibold">
                  <div className="mb-1">{r.label}</div>
                  <button type="button" onClick={() => toutAutoriser(r.valeur)} className="text-[10px] font-normal text-primary underline">
                    {t('tout autoriser')}
                  </button>
                  <div className="mt-1 flex justify-center gap-2 text-[10px] font-normal text-foreground-muted">
                    {ACTIONS.map((a) => <span key={a.cle} title={t(a.label)}>{t(a.label).slice(0, 1)}</span>)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupes.map((g) => (
              <Fragment key={g.titre}>
                <tr className="bg-surface/60">
                  <td colSpan={1 + roles.length} className="border-b border-surface-border px-3 py-1 font-semibold text-foreground-muted">
                    {t(g.titre)}
                  </td>
                </tr>
                {g.items.map((item) => (
                  <tr key={item.href}>
                    <td className="sticky start-0 z-10 border-b border-e border-surface-border bg-background px-3 py-1.5">{t(item.label)}</td>
                    {roles.map((r) => (
                      <td key={r.valeur} className="border-b border-e border-surface-border px-2 py-1.5">
                        <div className="flex justify-center gap-2">
                          {ACTIONS.map((a) => (
                            <label key={a.cle} title={t(a.label)} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={estAutorise(matrice, item.href, r.valeur, a.cle)}
                                onChange={() => basculer(item.href, r.valeur, a.cle)}
                                className="h-3.5 w-3.5"
                              />
                            </label>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
