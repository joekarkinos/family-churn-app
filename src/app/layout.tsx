import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ZadaniaDom',
  description: 'Domowe obowiązki rodziny Karkinosów',
  manifest: '/manifest.json',
  themeColor: '#1a1714',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ZadaniaDom',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
