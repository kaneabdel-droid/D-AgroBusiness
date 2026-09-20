import type { Metadata, Viewport } from 'next'
import { Inter, Outfit, Cairo } from 'next/font/google'
import './globals.css'
import { creerT, estRtl } from '@/lib/i18n'
import { langueChoisie, langueNavigateur } from '@/lib/i18n-server'

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })
const outfit = Outfit({ variable: '--font-outfit', subsets: ['latin'] })
// Police arabe (chargée seulement quand elle est utilisée) : titres et texte courant en arabe
const cairo = Cairo({ variable: '--font-cairo', subsets: ['arabic', 'latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const t = creerT(await langueNavigateur())
  return {
    title: t('D-AGROBUSINESS — Gestion intégrée de la chaîne de valeur agricole'),
    description: t('Financement, intrants, parc matériel, production, usine de transformation, RH et comptabilité analytique pour les entreprises agro-industrielles.'),
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // La langue de la page et le sens d'écriture suivent le choix de l'utilisateur ; sans choix, le français est la valeur par défaut
  // (les écrans connectés appliquent en plus la langue par défaut du pays de l'organisation, voir AppShell).
  const lang = (await langueChoisie()) ?? 'fr'
  return (
    <html
      lang={lang}
      dir={estRtl(lang) ? 'rtl' : 'ltr'}
      className={`${inter.variable} ${outfit.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
