import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ⚡ STRICT EDGE RUNTIME CONFIGURATION
// Esto fuerza a Vercel a usar el runtime ligero, evitando APIs de Node.js incompatibles.
export const config = {
    runtime: 'experimental-edge', // o 'edge'
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}

export async function middleware(request: NextRequest) {
    // 1. FAILSAFE: Bypass inmediato para Login y Auth
    if (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth')) {
        return NextResponse.next();
    }

    // 2. FAILSAFE: Verificar Variables de Entorno (Evitar Crash)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("🔥 CRITICAL: Faltan variables de entorno de Supabase en Middleware.");
        // Dejar pasar para que la UI manaje el error en lugar de dar 500
        return NextResponse.next();
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    try {
        const supabase = createServerClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                cookies: {
                    get(name: string) {
                        return request.cookies.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        // Actualizar cookie en Request (para uso inmediato)
                        request.cookies.set({
                            name,
                            value,
                            ...options,
                        })
                        // Recrear Response para sincronizar cookies
                        response = NextResponse.next({
                            request: {
                                headers: request.headers,
                            },
                        })
                        // Actualizar cookie en Response (para el navegador)
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

        // 3. Validar Sesión
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
            // Token expirado o inválido -> No es log de error crítico
            // console.log("Middleware Auth Info:", error.message);
        }

        // 4. Protección de Rutas
        // Si NO hay usuario y quiere entrar al dashboard -> Mandar a Login
        if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        // Si NO hay usuario y quiere entrar a la raíz (/) -> Mandar a Login
        if (!user && request.nextUrl.pathname === '/') {
            const url = request.nextUrl.clone()
            url.pathname = '/login'
            return NextResponse.redirect(url)
        }

        // Si YA hay usuario y quiere entrar al Login -> Mandar al Dashboard
        if (user && request.nextUrl.pathname.startsWith('/login')) {
            const url = request.nextUrl.clone()
            url.pathname = '/'
            return NextResponse.redirect(url)
        }

    } catch (e: any) {
        console.error("❌ MIDDLEWARE PANIC RECOVERED:", e.message);
        // En caso de pánico total, FAIL OPEN (Dejar pasar)
        return NextResponse.next();
    }

    return response
}
