import { adminAuth } from "@/lib/firebaseAdmin";
import {
  getAllMembers,
  getSession,
  updateSessionWithTasks,
  approveSession,
  createTask,
} from "@/lib/firestore";
import { generateContent } from "@/lib/gemini";
import type { Assignment, ClarifiedTask } from "@/types";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(session.value);
    const { sessionId, tasks } = (await request.json()) as {
      sessionId: string;
      tasks: ClarifiedTask[];
    };

    const sessionDoc = await getSession(sessionId);
    if (!sessionDoc || sessionDoc.managerUid !== decoded.uid) {
      return Response.json({ error: "権限がありません" }, { status: 403 });
    }

    const members = await getAllMembers();
    if (members.length === 0) {
      return Response.json({ error: "メンバーが登録されていません" }, { status: 400 });
    }

    const membersJson = JSON.stringify(
      members.map((m) => ({
        uid: m.uid,
        name: m.name,
        badgeScore: m.badgeScore,
        skills: m.skills,
      }))
    );

    const tasksJson = JSON.stringify(tasks);

    const prompt = `以下のタスク一覧と、チームメンバーのスキルスコアを見て、各タスクに最適なメンバーを推薦してください。

タスク一覧:
${tasksJson}

メンバー一覧（uid, name, badgeScore, skills）:
${membersJson}

【ルール】
- 各タスクのrequiredSkillに対応するskillスコアが高いメンバーを優先する
- 同じメンバーに複数タスクを割り当てても良いが、できれば分散させる
- 必ずJSONのみで返す（マークダウン不要）:
[{"taskTitle":"タスク名","assigneeUid":"uid","assigneeName":"名前","reason":"推薦理由（日本語50字以内）"}]`;

    const rawResponse = await generateContent(prompt);
    const clean = rawResponse.replace(/```json|```/g, "").trim();
    const assignments = JSON.parse(clean) as Assignment[];

    await updateSessionWithTasks(sessionId, tasks, assignments);

    return Response.json({ assignments });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "エラーが発生しました" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decodedPut = await adminAuth.verifyIdToken(session.value);
    const { sessionId } = (await request.json()) as { sessionId: string };

    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      return Response.json({ error: "セッションが見つかりません" }, { status: 404 });
    }
    if (sessionData.managerUid !== decodedPut.uid) {
      return Response.json({ error: "権限がありません" }, { status: 403 });
    }

    for (const assignment of sessionData.assignmentProposal) {
      const task = sessionData.clarifiedTasks.find(
        (t) => t.title === assignment.taskTitle
      );
      if (!task) continue;

      await createTask({
        title: task.title,
        description: task.description,
        requiredSkill: task.requiredSkill,
        deadline: task.deadline,
        assigneeUid: assignment.assigneeUid,
        assigneeName: assignment.assigneeName,
        status: "pending",
        createdAt: FieldValue.serverTimestamp() as unknown as import("firebase-admin/firestore").Timestamp,
      });
    }

    await approveSession(sessionId);

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "エラーが発生しました" },
      { status: 500 }
    );
  }
}
