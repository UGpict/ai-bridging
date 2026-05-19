import { adminAuth } from "@/lib/firebaseAdmin";
import {
  getTask,
  getUser,
  getOrganizationByManager,
  managerEvaluateTask,
  updateUserBadge,
  updateScoringWeights,
  addEvaluationHistory,
} from "@/lib/firestore";
import type { RequiredSkill, ScoringWeights } from "@/types";
import { cookies } from "next/headers";

const DEFAULT_WEIGHTS: ScoringWeights = {
  requirement: 1.0,
  clarity: 1.0,
  completeness: 1.0,
};

const LEARNING_RATE = 0.05;
const WEIGHT_MIN = 0.5;
const WEIGHT_MAX = 1.5;
const MIN_HISTORY_FOR_LEARNING = 5;

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

function clip(value: number): number {
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, value));
}

function learnWeights(
  currentWeights: ScoringWeights,
  aiBreakdown: { requirement: number; clarity: number; completeness: number },
  aiScore: number,
  managerScore: number,
  historyLength: number
): ScoringWeights {
  if (historyLength < MIN_HISTORY_FOR_LEARNING) return currentWeights;

  const diff = managerScore - aiScore;
  if (diff === 0) return currentWeights;

  const safeAiScore = Math.max(aiScore, 1);
  const reqContrib = aiBreakdown.requirement / safeAiScore;
  const clarContrib = aiBreakdown.clarity / safeAiScore;
  const compContrib = aiBreakdown.completeness / safeAiScore;

  // 一度の更新で最大 ±0.1 に制限
  const scale = LEARNING_RATE * Math.min(1, Math.abs(diff) / 20);

  return {
    requirement: clip(currentWeights.requirement + diff * reqContrib * scale),
    clarity: clip(currentWeights.clarity + diff * clarContrib * scale),
    completeness: clip(currentWeights.completeness + diff * compContrib * scale),
  };
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(session.value);

    const { taskId, managerScore, managerComment } = (await request.json()) as {
      taskId: string;
      managerScore: number;
      managerComment?: string;
    };

    if (typeof managerScore !== "number" || managerScore < 0 || managerScore > 100) {
      return Response.json({ error: "スコアは0〜100の数値で入力してください" }, { status: 400 });
    }

    const task = await getTask(taskId);
    if (!task) {
      return Response.json({ error: "タスクが見つかりません" }, { status: 404 });
    }
    if (task.status !== "ai_evaluated") {
      return Response.json({ error: "AI評価が完了していないか、既に確定済みです" }, { status: 409 });
    }
    if (!task.evaluation) {
      return Response.json({ error: "評価データが見つかりません" }, { status: 404 });
    }

    // 上司ロール確認
    const manager = await getUser(decoded.uid);
    if (!manager || manager.role !== "manager") {
      return Response.json({ error: "上司のみ操作できます" }, { status: 403 });
    }

    // orgId（設計上 managerUid と同値）経由で組織を取得
    const org = task.orgId ? await getOrganizationByManager(task.orgId) : null;
    if (!org || org.managerUid !== decoded.uid) {
      return Response.json({ error: "権限がありません" }, { status: 403 });
    }

    const currentWeights: ScoringWeights = org.scoringWeights ?? DEFAULT_WEIGHTS;
    const history = org.evaluationHistory ?? [];
    const aiBreakdown = task.evaluation.aiBreakdown;
    const aiScore = task.evaluation.aiScore;

    // バッジ更新
    const assignee = await getUser(task.assigneeUid);
    const currentBadgeScore = assignee?.badgeScore ?? 0;
    const delta = calcDelta(managerScore);
    const newBadgeScore = Math.max(0, currentBadgeScore + delta);
    const newLevel = calcBadgeLevel(newBadgeScore);

    const skillField: RequiredSkill =
      task.requiredSkill ??
      (task.description.includes("ci_cd") ||
      task.description.toLowerCase().includes("ci/cd") ||
      task.description.includes("デプロイ") ||
      task.description.includes("パイプライン")
        ? "ci_cd"
        : task.description.includes("documentation") ||
          task.description.includes("資料") ||
          task.description.includes("ドキュメント")
        ? "documentation"
        : task.description.includes("communication") ||
          task.description.includes("調整") ||
          task.description.includes("連絡")
        ? "communication"
        : "technical");

    // 評価履歴追加 → 重み学習（history.length + 1 件目として判定）
    const newHistoryLength = history.length + 1;
    const newWeights = learnWeights(
      currentWeights,
      aiBreakdown,
      aiScore,
      managerScore,
      newHistoryLength
    );

    await Promise.all([
      managerEvaluateTask(taskId, managerScore, managerComment, delta, newLevel),
      updateUserBadge(task.assigneeUid, newBadgeScore, newLevel, skillField, Math.max(0, delta)),
      addEvaluationHistory(org.id, {
        taskId,
        aiScore,
        managerScore,
        aiBreakdown,
      }),
      updateScoringWeights(org.id, newWeights),
    ]);

    return Response.json({
      finalScore: managerScore,
      delta,
      level: newLevel,
      newWeights,
      aiFeedback: task.evaluation.aiFeedback,
    });
  } catch {
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
