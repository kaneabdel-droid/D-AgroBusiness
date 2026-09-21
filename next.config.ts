import type { NextConfig } from "next";

// En-têtes de sécurité appliqués à toutes les réponses.
// La politique de contenu n'autorise que le site lui-même et Supabase (données, authentification) ; les pages de paiement des
// prestataires sont ouvertes par navigation (window.location), pas intégrées, donc n'ont pas besoin d'être listées.
const supabase = 'https://*.supabase.co'
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",   // Next.js injecte des scripts en ligne (données de rendu) ; pas de nonce à ce stade
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} wss://*.supabase.co`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const nextConfig: NextConfig = {
  experimental: {
    // Import CSV des barèmes de retenue à la source (fichier de plusieurs Mo)
    serverActions: { bodySizeLimit: '10mb' },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default nextConfig;
