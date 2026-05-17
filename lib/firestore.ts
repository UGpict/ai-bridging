import { adminDb } from "./firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import type { User, Task, Session, ClarifiedTask, Assignment, SessionMessage, Organization } from "@/types";

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
  let query = adminDb.collection("tasks").orderBy("createdAt", "desc");
  if (orgId) query = query.where("orgId", "==", orgId) as typeof query;
  const snap = await query.get();
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

export async function evaluateTask(
  taskId: string,
  evaluation: Task["evaluation"]
): Promise<void> {
  await adminDb.collection("tasks").doc(taskId).update({
    status: "evaluated",
    evaluation,
  });
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

export async function approveSession(sessionId: string): Promise<void> {
  await adminDb.collection("sessions").doc(sessionId).update({
    status: "approved",
  });
}
