import { adminAuth } from "@/lib/firebaseAdmin";
import { getTask, aiEvaluateTask, getUser, getOrganizationByManager } from "@/lib/firestore";
import { generateContent } from "@/lib/gemini";
import type { RequiredSkill, ScoringWeights, TaskEvaluation } from "@/types";
import { cookies } from "next/headers";

const DEFAULT_WEIGHTS: ScoringWeights = {
  requirement: 1.0,
  clarity: 1.0,
  completeness: 1.0,
};

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

    const decoded = await adminAuth.verifyIdToken(session.value);
    const { taskId } = (await request.json()) as { taskId: string };

    const task = await getTask(taskId);
    if (!task || !task.submission) {
      return Response.json({ error: "タスクまたは提出物が見つかりません" }, { status: 404 });
    }
    if (task.assigneeUid !== decoded.uid) {
      return Response.json({ error: "権限がありません" }, { status: 403 });
    }
    if (task.status === "ai_evaluated" || task.status === "evaluated") {
      return Response.json({ error: "既に評価済みです" }, { status: 409 });
    }
    if (task.status !== "submitted") {
      return Response.json({ error: "提出されていないタスクは評価できません" }, { status: 400 });
    }

    // 上司の採点重みを取得（managerUidはtask.orgId === org.idのmanagerUidから引く）
    // orgIdとmanagerUidは同値の設計なのでorgIdで直引き
    const org = task.orgId
      ? await getOrganizationByManager(task.orgId)
      : null;
    const weights: ScoringWeights = org?.scoringWeights ?? DEFAULT_WEIGHTS;

    const weightNote =
      weights.requirement !== 1.0 || weights.clarity !== 1.0 || weights.completeness !== 1.0
        ? `\n\n【採点傾向の補正】この組織の過去の採点傾向に基づき以下の重みで採点してください：
- タスク要件充足度: ${weights.requirement.toFixed(2)}倍（重み調整済み）
- 明確性: ${weights.clarity.toFixed(2)}倍（重み調整済み）
- 完結性: ${weights.completeness.toFixed(2)}倍（重み調整済み）`
        : "";

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
- 完結性: 0-30点（結論の明示・次のアクションの明確さ）${weightNote}

必ずJSONのみで返す（マークダウン不要）:
{"breakdown":{"requirement":数値,"clarity":数値,"completeness":数値},"score":合計数値,"feedback":"丁寧語でのフィードバック（良かった点と改善点を含む）"}`;

    const rawResponse = await generateContent(prompt);
    const clean = rawResponse.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean) as {
      breakdown: { requirement: number; clarity: number; completeness: number };
      score: number;
      feedback: string;
    };

    // breakdown の合計と score の乖離を補正
    parsed.score =
      parsed.breakdown.requirement +
      parsed.breakdown.clarity +
      parsed.breakdown.completeness;

    const user = await getUser(task.assigneeUid);
    const currentScore = user?.badgeScore ?? 0;
    const delta = calcDelta(parsed.score);
    const projectedScore = Math.max(0, currentScore + delta);
    const projectedLevel = calcBadgeLevel(projectedScore);

    const evaluation: TaskEvaluation = {
      aiBreakdown: parsed.breakdown,
      aiScore: parsed.score,
      aiFeedback: parsed.feedback,
      finalScore: parsed.score, // 上司評価が入るまでは aiScore
      delta,
      level: projectedLevel,
    };

    await aiEvaluateTask(taskId, evaluation);

    // 部下に返すレスポンス（aiBreakdownは含めない）
    return Response.json({
      aiScore: parsed.score,
      aiFeedback: parsed.feedback,
      finalScore: parsed.score,
      delta,
      level: projectedLevel,
    });
  } catch {
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}

export type { RequiredSkill };
