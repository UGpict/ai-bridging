import { adminAuth } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/firestore";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken: string };

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const cookieStore = await cookies();
    cookieStore.set("__session", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60, // 1 hour
      path: "/",
    });

    const user = await getUser(uid);
    if (!user) {
      return Response.json({ role: "new" });
    }

    return Response.json({ role: user.role });
  } catch {
    return Response.json({ error: "認証に失敗しました" }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("__session");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "ログアウトに失敗しました" }, { status: 500 });
  }
}
