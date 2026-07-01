import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteUserAccount, getApiUser, revokeToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const COOKIE = "chessschool_session";

/** Permanently delete the authenticated user's account (mobile Bearer or web cookie). */
export async function DELETE(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) await revokeToken(bearer.slice(7));

  const jar = await cookies();
  const cookieToken = jar.get(COOKIE)?.value;
  if (cookieToken) await revokeToken(cookieToken);

  const res = await deleteUserAccount(user.id);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 403 });

  jar.delete(COOKIE);
  return NextResponse.json({ ok: true });
}
