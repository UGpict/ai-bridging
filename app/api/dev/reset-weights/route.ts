import { adminAuth } from "@/lib/firebaseAdmin";
import { getOrganizationByManager, resetScoringWeights } from "@/lib/firestore";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  if (process.env.ENABLE_DEV_TOOLS !== "true") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(session.value);
    const { managerUid } = (await request.json()) as { managerUid?: string };
    const targetUid = managerUid ?? decoded.uid;

    const org = await getOrganizationByManager(targetUid);
    if (!org) {
      return Response.json({ error: "組織が見つかりません" }, { status: 404 });
    }

    await resetScoringWeights(org.id);
    return Response.json({ ok: true, orgId: org.id });
  } catch {
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
