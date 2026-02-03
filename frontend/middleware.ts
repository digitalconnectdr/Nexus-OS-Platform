import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    // 🚨 EMERGENCY BYPASS: MIDDLEWARE DISABLED 🚨
    // El usuario solicitó desactivar la lógica para recuperar el acceso a la web.
    // TODO: Restaurar lógica de Supabase cuando se estabilice el entorno Edge.

    return NextResponse.next({
        request: {
            headers: request.headers,
        },
    })
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
