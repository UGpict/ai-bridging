import { adminAuth } from "@/lib/firebaseAdmin";
import { getTask, submitTask } from "@/lib/firestore";
import { cookies } from "next/headers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    await adminAuth.verifyIdToken(session.value);
    const { id } = await ctx.params;
    const task = await getTask(id);
    if (!task) {
      return Response.json({ error: "タスクが見つかりません" }, { status: 404 });
    }

    return Response.json(task);
  } catch {
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(session.value);
    const { id } = await ctx.params;
    const { submission, prUrl } = (await request.json()) as { submission: string; prUrl?: string };

    if (!submission?.trim() || submission.length > 10000) {
      return Response.json({ error: "提出テキストは1〜10000文字で入力してください" }, { status: 400 });
    }
    if (prUrl !== undefined && prUrl !== "") {
      try { new URL(prUrl); } catch {
        return Response.json({ error: "PRのURLが不正です" }, { status: 400 });
      }
      if (!prUrl.startsWith("https://")) {
        return Response.json({ error: "PRのURLはhttpsで始まる必要があります" }, { status: 400 });
      }
    }

    const existing = await getTask(id);
    if (!existing) {
      return Response.json({ error: "タスクが見つかりません" }, { status: 404 });
    }
    if (existing.assigneeUid !== decoded.uid) {
      return Response.json({ error: "権限がありません" }, { status: 403 });
    }
    if (existing.status !== "pending") {
      return Response.json({ error: "既に提出済みまたは評価済みです" }, { status: 409 });
    }

    await submitTask(id, submission, prUrl);
    const task = await getTask(id);

    return Response.json(task);
  } catch {
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
