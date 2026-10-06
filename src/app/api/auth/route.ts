import { isDevelopment, loginWithHr } from "@/modules/hr/adapter";
import { NextResponse } from "next/server";
import { z } from "zod";
import { signIn, signOut } from "@/modules/auth/session";
import { respondError, sameOrigin } from "@/modules/shared/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    const token = isDevelopment()
      ? z.object({ token: z.string().min(1).max(6000) }).parse(body).token
      : await (async () => {
          const credentials = z
            .object({ email: z.email(), password: z.string().min(4).max(200) })
            .parse(body);
          return loginWithHr(credentials.email, credentials.password);
        })();
    const { remember } = z
      .object({ remember: z.boolean().default(false) })
      .parse(body);
    await signIn(token, remember);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respondError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    await signOut();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return respondError(error);
  }
}
