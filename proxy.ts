import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Route groups like (app) don't affect the URL — these are the top-level
// paths served by app/(app)/* that require a signed-in Supabase user.
const PROTECTED_PATHS = [
  "/dashboard",
  "/analytics",
  "/clients",
  "/content",
  "/demo-requests",
  "/integrations",
  "/proposals",
  "/settings",
  "/signatures",
  "/team",
  "/templates",
  "/onboarding",
];

function isProtected(pathname: string) {
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  if (!user && isProtected(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
