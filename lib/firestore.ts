import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  User,
  Task,
  Session,
  ClarifiedTask,
  Assignment,
  SessionMessage,
  Organization,
  TaskEvaluation,
  TaskCandidates,
  ScoringWeights,
  EvaluationHistoryEntry,
} from "@/types";

// ---- Users ----

export async function getUser(uid: string): Promise<User | null> {
  const doc = await adminDb.collection("users").doc(uid).get();
  if (!doc.exists) return null;
  return doc.data() as User;
}

export async function getAllMembers(orgId?: string): Promise<User[]> {
  let query = adminDb.collection("users").where("role", "==", "member");
  if (orgId) query = query.where("orgId", "==", orgId) as typeof query;
  const snap = await query.get();
  return snap.docs.map((d) => d.data() as User);
}

export async function createUser(user: User): Promise<void> {
  await adminDb.collection("users").doc(user.uid).set(user);
}

export async function deleteUser(uid: string): Promise<void> {
  await adminDb.collection("users").doc(uid).delete();
}

// ---- Organizations ----

export async function createOrganization(org: Organization): Promise<void> {
  await adminDb.collection("organizations").doc(org.id).set({
    ...org,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function getOrganizationByCode(inviteCode: string): Promise<Organization | null> {
  const snap = await adminDb
    .collection("organizations")
    .where("inviteCode", "==", inviteCode)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as Organization;
}

export async function getOrganizationByManager(managerUid: string): Promise<Organization | null> {
  const doc = await adminDb.collection("organizations").doc(managerUid).get();
  if (!doc.exists) return null;
  return doc.data() as Organization;
}

export async function getOrganizationById(orgId: string): Promise<Organization | null> {
  const snap = await adminDb
    .collection("organizations")
    .where("id", "==", orgId)
    .limit(1)
    .get();
  if (snap.empty) {
    // orgId === managerUid の設計のためdoc idで直引きも試みる
    const doc = await adminDb.collection("organizations").doc(orgId).get();
    if (!doc.exists) return null;
    return doc.data() as Organization;
  }
  return snap.docs[0].data() as Organization;
}

export async function updateScoringWeights(
  orgDocId: string,
  weights: ScoringWeights
): Promise<void> {
  await adminDb.collection("organizations").doc(orgDocId).update({
    scoringWeights: weights,
  });
}

export async function addEvaluationHistory(
  orgDocId: string,
  entry: Omit<EvaluationHistoryEntry, "timestamp">
): Promise<void> {
  const doc = await adminDb.collection("organizations").doc(orgDocId).get();
  const data = doc.data() as Organization | undefined;
  const history: EvaluationHistoryEntry[] = (data?.evaluationHistory ?? []) as EvaluationHistoryEntry[];

  const newEntry = {
    ...entry,
    timestamp: FieldValue.serverTimestamp(),
  };

  // 直近20件を保持
  const trimmed = [newEntry, ...history].slice(0, 20);

  await adminDb.collection("organizations").doc(orgDocId).update({
    evaluationHistory: trimmed,
  });
}

export async function resetScoringWeights(orgDocId: string): Promise<void> {
  await adminDb.collection("organizations").doc(orgDocId).update({
    scoringWeights: { requirement: 1.0, clarity: 1.0, completeness: 1.0 },
    evaluationHistory: [],
  });
}

// ---- Users Badge ----

export async function updateUserBadge(
  uid: string,
  badgeScore: number,
  badgeLevel: string,
  skillField: string,
  skillDelta: number
): Promise<void> {
  await adminDb
    .collection("users")
    .doc(uid)
    .update({
      badgeScore,
      badgeLevel,
      [`skills.${skillField}`]: FieldValue.increment(skillDelta),
    });
}

// ---- Tasks ----

export async function getTask(taskId: string): Promise<Task | null> {
  const doc = await adminDb.collection("tasks").doc(taskId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Task;
}

export async function getTasksByAssignee(uid: string): Promise<Task[]> {
  const snap = await adminDb
    .collection("tasks")
    .where("assigneeUid", "==", uid)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task);
}

export async function getAllTasks(orgId?: string): Promise<Task[]> {
  const base = adminDb.collection("tasks");
  const filtered = orgId ? base.where("orgId", "==", orgId) : base;
  const snap = await filtered.orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Task);
}

export async function createTask(
  task: Omit<Task, "id">
): Promise<string> {
  const ref = await adminDb.collection("tasks").add(task);
  return ref.id;
}

export async function submitTask(
  taskId: string,
  submission: string,
  prUrl?: string
): Promise<void> {
  const data: Record<string, string> = { status: "submitted", submission };
  if (prUrl) data.prUrl = prUrl;
  await adminDb.collection("tasks").doc(taskId).update(data);
}

export async function aiEvaluateTask(
  taskId: string,
  evaluation: TaskEvaluation
): Promise<void> {
  await adminDb.collection("tasks").doc(taskId).update({
    status: "ai_evaluated",
    evaluation,
  });
}

export async function managerEvaluateTask(
  taskId: string,
  managerScore: number,
  managerComment: string | undefined,
  delta: number,
  level: string
): Promise<void> {
  await adminDb.collection("tasks").doc(taskId).update({
    status: "evaluated",
    "evaluation.managerScore": managerScore,
    "evaluation.managerComment": managerComment ?? null,
    "evaluation.finalScore": managerScore,
    "evaluation.delta": delta,
    "evaluation.level": level,
  });
}

// 後方互換: 旧 evaluateTask（既存コードが参照しているため残す）
export async function evaluateTask(
  taskId: string,
  evaluation: Task["evaluation"]
): Promise<void> {
  await adminDb.collection("tasks").doc(taskId).update({
    status: "evaluated",
    evaluation,
  });
}

/**
 * orgId 内の未評価タスク（pending | submitted | ai_evaluated）を
 * assigneeUid 別にカウントして返す
 */
export async function getPendingTaskCountByMember(
  orgId: string
): Promise<Record<string, number>> {
  const snap = await adminDb
    .collection("tasks")
    .where("orgId", "==", orgId)
    .where("status", "in", ["pending", "submitted", "ai_evaluated"])
    .get();

  const counts: Record<string, number> = {};
  for (const doc of snap.docs) {
    const uid = (doc.data() as Task).assigneeUid;
    counts[uid] = (counts[uid] ?? 0) + 1;
  }
  return counts;
}

// ---- Sessions ----

export async function getSession(sessionId: string): Promise<Session | null> {
  const doc = await adminDb.collection("sessions").doc(sessionId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Session;
}

export async function createSession(
  session: Omit<Session, "id">
): Promise<string> {
  const ref = await adminDb.collection("sessions").add(session);
  return ref.id;
}

export async function updateSessionMessages(
  sessionId: string,
  messages: SessionMessage[]
): Promise<void> {
  await adminDb.collection("sessions").doc(sessionId).update({ messages });
}

export async function updateSessionWithTasks(
  sessionId: string,
  clarifiedTasks: ClarifiedTask[],
  assignmentProposal: Assignment[]
): Promise<void> {
  await adminDb.collection("sessions").doc(sessionId).update({
    clarifiedTasks,
    assignmentProposal,
    status: "proposed",
  });
}

export async function updateSessionCandidates(
  sessionId: string,
  candidateProposals: TaskCandidates[]
): Promise<void> {
  await adminDb.collection("sessions").doc(sessionId).update({
    candidateProposals,
    status: "proposed",
  });
}

export async function approveSession(sessionId: string): Promise<void> {
  await adminDb.collection("sessions").doc(sessionId).update({
    status: "approved",
  });
}
