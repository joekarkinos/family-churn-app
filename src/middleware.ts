import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options: CookieOptions }

// Trasy dzieci i rodziców (route groups (child) / (parent) nie pojawiają się w URL).
const CHILD_PATHS = ['/zadania', '/moje-zadania', '/monety', '/profil']
const PARENT_PATHS = ['/panel', '/dodaj', '/zatwierdz', '/wyplaty', '/statystyki']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isChildPath = CHILD_PATHS.some((p) => path === p || path.startsWith(p + '/'))
  const isParentPath = PARENT_PATHS.some((p) => path === p || path.startsWith(p + '/'))
  const isProtected = isChildPath || isParentPath

  // Niezalogowany na chronionej trasie → ekran logowania.
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Zalogowany — sprawdź rolę względem grupy tras.
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    if (role === 'child' && isParentPath) {
      return NextResponse.redirect(new URL('/zadania', request.url))
    }
    if (role === 'parent' && isChildPath) {
      return NextResponse.redirect(new URL('/panel', request.url))
    }
  }

  return response
}

export const config = {
  // Pomijamy zasoby statyczne i obrazy.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.png$).*)'],
}
