import { NextResponse, type NextRequest } from "next/server";

/** Públicas: login, cadastro e a rota da agenda (que tem a própria senha, CRON_SECRET). */
const PUBLIC_PATHS = ["/login", "/cadastro", "/api/cron"];

/**
 * Checagem otimista: sem cookie de sessão, manda para o login.
 * A validação real da sessão acontece no servidor (requireUser) em cada página e action.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("mi_session");
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && pathname.startsWith("/api/") && !isPublic) {
    return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  }
  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|.*\\.(?:png|svg|jpg|ico)$).*)"],
};
