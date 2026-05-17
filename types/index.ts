import type { Timestamp } from "firebase-admin/firestore";

export type BadgeLevel = "見習い" | "初級" | "中級" | "上級" | "エキスパート";
export type UserRole = "manager" | "member";
export type TaskStatus = "pending" | "submitted" | "evaluated";
export type RequiredSkill = "documentation" | "communication" | "technical";
export type SessionStatus = "chatting" | "proposed" | "approved";
export type TaskDeadline = "today" | "project";

export interface Organization {
  id: string;
  name: string;
  managerUid: string;
  managerName: string;
  inviteCode: string;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  badgeScore: number;
  badgeLevel: BadgeLevel;
  skills: {
    documentation: number;
    communication: number;
    technical: number;
  };
  orgId?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  requiredSkill?: RequiredSkill;
  deadline?: TaskDeadline;
  assigneeUid: string;
  assigneeName: string;
  status: TaskStatus;
  createdAt: Timestamp;
  submission?: string;
  evaluation?: {
    breakdown: {
      requirement: number;
      clarity: number;
      completeness: number;
    };
    score: number;
    delta: number;
    level: string;
    feedback: string;
  };
}

export interface ClarifiedTask {
  title: string;
  description: string;
  requiredSkill: RequiredSkill;
  deadline?: TaskDeadline;
}

export interface Assignment {
  taskTitle: string;
  assigneeUid: string;
  assigneeName: string;
  reason: string;
}

export interface SessionMessage {
  role: "user" | "model";
  content: string;
}

export interface Session {
  id: string;
  managerUid: string;
  originalInstruction: string;
  clarifiedTasks: ClarifiedTask[];
  assignmentProposal: Assignment[];
  status: SessionStatus;
  messages: SessionMessage[];
  createdAt: Timestamp;
}

export interface GeminiChatResponse {
  status: "questioning" | "complete";
  message?: string;
  tasks?: ClarifiedTask[];
}

export interface EvaluationResponse {
  breakdown: {
    requirement: number;
    clarity: number;
    completeness: number;
  };
  score: number;
  delta: number;
  level: string;
  feedback: string;
}
