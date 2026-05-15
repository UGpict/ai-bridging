import { adminAuth } from "@/lib/firebaseAdmin";
import { getTask, evaluateTask, getUser, updateUserBadge } from "@/lib/firestore";
import { generateContent } from "@/lib/gemini";
import type { EvaluationResponse } from "@/types";
import { cookies } from "next/headers";

function calcBadgeLevel(score: number): string {
  if (score >= 800) return "エキスパート";
  if (score >= 600) return "上級";
  if (score >= 400) return "中級";
  if (score >= 200) return "初級";
  return "見習い";
}

function calcDelta(score: number): number {
  if (score >= 90) return 30;
  if (score >= 75) return 20;
  if (score >= 60) return 10;
  if (score >= 40) return 5;
  return -5;
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    await adminAuth.verifyIdToken(session.value);
    const { taskId } = (await request.json()) as { taskId: string };

    const task = await getTask(taskId);
    if (!task || !task.submission) {
      return Response.json({ error: "タスクまたは提出物が見つかりません" }, { status: 404 });
    }

    const prompt = `以下のタスクの要件と、部下が提出したテキストを照合し、採点してください。

【タスク名】
${task.title}

【タスク詳細】
${task.description}

【提出テキスト】
${task.submission}

【採点ルーブリック（合計100点）】
- タスク要件充足度: 0-40点（要件への言及・具体性）
- 明確性: 0-30点（文章の明確さ・曖昧さのなさ）
- 完結性: 0-30点（結論の明示・次のアクションの明確さ）

必ずJSONのみで返す（マークダウン不要）:
{"breakdown":{"requirement":数値,"clarity":数値,"completeness":数値},"score":合計数値,"feedback":"丁寧語でのフィードバック（良かった点と改善点を含む）"}`;

    const rawResponse = await generateContent(prompt);
    const clean = rawResponse.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as Omit<EvaluationResponse, "delta" | "level">;

    const delta = calcDelta(parsed.score);
    const user = await getUser(task.assigneeUid);
    const newScore = Math.max(0, (user?.badgeScore ?? 0) + delta);
    const newLevel = calcBadgeLevel(newScore);

    const evaluation: EvaluationResponse = {
      ...parsed,
      delta,
      level: newLevel,
    };

    await evaluateTask(taskId, evaluation);

    const skillField = (() => {
      if (task.description.includes("documentation")) return "documentation";
      if (task.description.includes("communication")) return "communication";
      return "technical";
    })();

    await updateUserBadge(task.assigneeUid, newScore, newLevel, skillField, Math.max(0, delta));

    return Response.json(evaluation);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "エラーが発生しました" },
      { status: 500 }
    );
  }
}
