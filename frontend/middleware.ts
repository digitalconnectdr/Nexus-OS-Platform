import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    let user = null;

    try {
        const { data: { user: supabaseUser }, error } = await supabase.auth.getUser()
        if (error) {
            console.warn("⚠️ Middleware Auth Error:", error.message);
        } else {
            user = supabaseUser;
        }
    } catch (err) {
        console.error("❌ Middleware Critical Failure:", err);
        // Failsafe: Si falla todo, asumimos no autenticado pero no rompemos la app
    }

    // LÓGICA DE PROTECCIÓN:

    // 1. Si NO hay usuario y quiere entrar al dashboard -> Mandar a Login
    if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // 2. Si NO hay usuario y quiere entrar a la raíz (/) -> Mandar a Login
    // NOTA: Si prefieres que la home sea pública, quita esto.
    if (!user && request.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // 3. Si YA hay usuario y quiere entrar al Login -> Mandar al Dashboard
    if (user && request.nextUrl.pathname.startsWith('/login')) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Coincidir con todas las rutas excepto:
         * - _next/static (archivos estáticos)
         * - _next/image (optimización de imágenes)
         * - favicon.ico (icono)
         * - api/ (rutas API si las tienes en nextjs)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
