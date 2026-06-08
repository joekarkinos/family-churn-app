import type { Metadata, Viewport } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ZadaniaDom',
  description: 'Domowe obowiązki rodziny Karkinosów',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ZadaniaDom',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1714',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl" className={`${syne.variable} ${dmSans.variable}`}>
      <body className="bg-surface font-sans antialiased">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{ style: { fontFamily: 'var(--font-dm-sans), sans-serif' } }}
        />
      </body>
    </html>
  )
}
