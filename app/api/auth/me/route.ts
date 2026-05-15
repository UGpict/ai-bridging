import { adminAuth } from "@/lib/firebaseAdmin";
import { getUser } from "@/lib/firestore";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(session.value);
    const user = await getUser(decoded.uid);
    if (!user) {
      return Response.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }

    return Response.json(user);
  } catch {
    return Response.json({ error: "認証に失敗しました" }, { status: 401 });
  }
}
