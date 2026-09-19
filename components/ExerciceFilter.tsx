import { Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/** Filtre GET (sans JS) : recharge la page avec ?exercice=<id>. */
export function ExerciceFilter({
  exercices,
  selectionne,
}: {
  exercices: { id: string; libelle: string }[]
  selectionne: string | undefined
}) {
  return (
    <form className="flex gap-2" method="get">
      <Select name="exercice" defaultValue={selectionne} aria-label="Exercice">
        {exercices.map((e) => (
          <option key={e.id} value={e.id}>{e.libelle}</option>
        ))}
      </Select>
      <Button type="submit" variant="outline">Afficher</Button>
    </form>
  )
}
