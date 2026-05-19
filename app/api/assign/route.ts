import { adminAuth } from "@/lib/firebaseAdmin";
import {
  getAllMembers,
  getSession,
  getOrganizationByManager,
  updateSessionCandidates,
  approveSession,
  createTask,
  getPendingTaskCountByMember,
} from "@/lib/firestore";
import type {
  Candidate,
  ClarifiedTask,
  RequiredSkill,
  SelectedAssignment,
  TaskCandidates,
  User,
} from "@/types";
import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";

const BADGE_THRESHOLDS: Record<string, number> = {
  見習い: 200,
  初級: 400,
  中級: 600,
  上級: 800,
  エキスパート: Infinity,
};

function scoreToNextThreshold(badgeScore: number): number {
  const thresholds = [200, 400, 600, 800];
  for (const t of thresholds) {
    if (badgeScore < t) return t - badgeScore;
  }
  return Infinity;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCandidates(
  task: ClarifiedTask,
  taskIndex: number,
  members: User[],
  pendingCounts: Record<string, number>
): TaskCandidates {
  const skill = task.requiredSkill;
  const used = new Set<string>();
  const candidates: Candidate[] = [];

  // --- カードA: スキルマッチ型 ---
  const bySkill = [...members].sort((a, b) => {
    const diff = (b.skills[skill] ?? 0) - (a.skills[skill] ?? 0);
    if (diff !== 0) return diff;
    return Math.random() - 0.5; // 同点はランダム
  });

  const skillMatch = bySkill[0];
  if (skillMatch) {
    used.add(skillMatch.uid);
    const skillScore = skillMatch.skills[skill] ?? 0;
    candidates.push({
      uid: skillMatch.uid,
      name: skillMatch.name,
      badgeLevel: skillMatch.badgeLevel,
      badgeScore: skillMatch.badgeScore,
      type: "skill_match",
      reason: `${skill === "technical" ? "技術" : skill === "documentation" ? "資料作成" : skill === "communication" ? "調整" : "CI/CD"}スコア${skillScore}、チーム最高値`,
      skills: skillMatch.skills,
    });
  }

  // --- カードB: 成長機会型 ---
  // 次のバッジ閾値まで最も近い人（かつ used に含まれない）
  const byGrowth = [...members]
    .filter((m) => !used.has(m.uid))
    .sort((a, b) => {
      const distA = scoreToNextThreshold(a.badgeScore);
      const distB = scoreToNextThreshold(b.badgeScore);
      return distA - distB;
    });

  const growthPick = byGrowth[0];
  if (growthPick) {
    used.add(growthPick.uid);
    const dist = scoreToNextThreshold(growthPick.badgeScore);
    const nextLevel = Object.entries(BADGE_THRESHOLDS)
      .sort((a, b) => a[1] - b[1])
      .find(([, v]) => growthPick.badgeScore < v)?.[0] ?? "エキスパート";
    const distStr = dist === Infinity ? "到達済み" : `残り${dist}pt`;
    candidates.push({
      uid: growthPick.uid,
      name: growthPick.name,
      badgeLevel: growthPick.badgeLevel,
      badgeScore: growthPick.badgeScore,
      type: "growth",
      reason: `${nextLevel}まで${distStr}、このタスクでレベルアップが狙える`,
      skills: growthPick.skills,
    });
  }

  // --- カードC: 負荷分散型 ---
  // 現在のアクティブタスク数が最も少ない人（かつ used に含まれない）
  const byLoad = [...members]
    .filter((m) => !used.has(m.uid))
    .sort((a, b) => {
      const loadA = pendingCounts[a.uid] ?? 0;
      const loadB = pendingCounts[b.uid] ?? 0;
      if (loadA !== loadB) return loadA - loadB;
      return Math.random() - 0.5;
    });

  const loadPick = byLoad[0];
  if (loadPick) {
    used.add(loadPick.uid);
    const load = pendingCounts[loadPick.uid] ?? 0;
    candidates.push({
      uid: loadPick.uid,
      name: loadPick.name,
      badgeLevel: loadPick.badgeLevel,
      badgeScore: loadPick.badgeScore,
      type: "load_balance",
      reason: `現在の担当タスク${load}件、チーム内で最も余裕あり`,
      skills: loadPick.skills,
    });
  }

  return {
    taskIndex,
    taskTitle: task.title,
    requiredSkill: skill as RequiredSkill,
    candidates: shuffle(candidates), // カードの順序をシャッフルしてVS感を出す
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
    const { sessionId, tasks } = (await request.json()) as {
      sessionId: string;
      tasks: ClarifiedTask[];
    };

    const sessionDoc = await getSession(sessionId);
    if (!sessionDoc || sessionDoc.managerUid !== decoded.uid) {
      return Response.json({ error: "権限がありません" }, { status: 403 });
    }

    const org = await getOrganizationByManager(decoded.uid);
    const [members, pendingCounts] = await Promise.all([
      getAllMembers(org?.id),
      org?.id ? getPendingTaskCountByMember(org.id) : Promise.resolve({} as Record<string, number>),
    ]);

    if (members.length === 0) {
      return Response.json({ error: "メンバーが登録されていません" }, { status: 400 });
    }

    const candidateProposals: TaskCandidates[] = tasks.map((task, i) =>
      buildCandidates(task, i, members, pendingCounts)
    );

    await updateSessionCandidates(sessionId, candidateProposals);

    return Response.json({ candidateProposals });
  } catch {
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("__session");
    if (!session) {
      return Response.json({ error: "未認証" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(session.value);
    const { sessionId, selectedAssignments } = (await request.json()) as {
      sessionId: string;
      selectedAssignments: SelectedAssignment[];
    };

    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      return Response.json({ error: "セッションが見つかりません" }, { status: 404 });
    }
    if (sessionData.managerUid !== decoded.uid) {
      return Response.json({ error: "権限がありません" }, { status: 403 });
    }
    if (sessionData.status === "approved") {
      return Response.json({ error: "既に承認済みです" }, { status: 409 });
    }

    const managerOrg = await getOrganizationByManager(sessionData.managerUid);
    const candidates = sessionData.candidateProposals ?? [];

    for (const sel of selectedAssignments) {
      const taskProposal = candidates[sel.taskIndex];
      const task = sessionData.clarifiedTasks[sel.taskIndex];
      if (!task) continue;

      await createTask({
        title: task.title,
        description: task.description,
        requiredSkill: task.requiredSkill,
        deadline: task.deadline,
        orgId: managerOrg?.id,
        assigneeUid: sel.assigneeUid,
        assigneeName: sel.assigneeName,
        status: "pending",
        createdAt: FieldValue.serverTimestamp() as unknown as import("firebase-admin/firestore").Timestamp,
      });

      // 未使用変数を防ぐためtaskProposalを参照
      void taskProposal;
    }

    await approveSession(sessionId);

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}
