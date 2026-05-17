import { adminAuth } from "@/lib/firebaseAdmin";
import { getUser, deleteUser } from "@/lib/firestore";
import { cookies } from "next/headers";

type Ctx = { params: Promise<{ uid: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(session.value);
    const caller = await getUser(decoded.uid);
    if (!caller || caller.role !== "manager") {
      return Response.json({ error: "権限がありません" }, { status: 403 });
    }

    const { uid } = await ctx.params;
    const target = await getUser(uid);
    if (!target) {
      return Response.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }
    if (target.orgId !== caller.orgId) {
      return Response.json({ error: "権限がありません" }, { status: 403 });
    }

    await deleteUser(uid);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
