import { Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/** Filtre GET (sans JS) : recharge la page avec ?exercice=<id>. */
export function ExerciceFilter({
  exercices,
  selectionne,
  libelleAria = 'Exercice',
  libelleBouton = 'Afficher',
}: {
  exercices: { id: string; libelle: string }[]
  selectionne: string | undefined
  libelleAria?: string
  libelleBouton?: string
}) {
  return (
    <form className="flex gap-2" method="get">
      <Select name="exercice" defaultValue={selectionne} aria-label={libelleAria}>
        {exercices.map((e) => (
          <option key={e.id} value={e.id}>{e.libelle}</option>
        ))}
      </Select>
      <Button type="submit" variant="outline">{libelleBouton}</Button>
    </form>
  )
}
