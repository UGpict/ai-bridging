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

    await adminAuth.verifyIdToken(session.value);
    const { id } = await ctx.params;
    const { submission } = (await request.json()) as { submission: string };

    await submitTask(id, submission);
    const task = await getTask(id);

    return Response.json(task);
  } catch {
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
