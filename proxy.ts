import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Every page except /login and the Auth.js routes requires a signed-in user.
export const proxy = auth((request) => {
  if (request.auth) return NextResponse.next();

  const login = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
