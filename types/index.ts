import type { Timestamp } from "firebase-admin/firestore";

export type BadgeLevel = "見習い" | "初級" | "中級" | "上級" | "エキスパート";
export type UserRole = "manager" | "member";
export type TaskStatus = "pending" | "submitted" | "ai_evaluated" | "evaluated";
export type RequiredSkill = "documentation" | "communication" | "technical" | "ci_cd";
export type SessionStatus = "chatting" | "proposed" | "approved";
export type TaskDeadline = "today" | "project";
export type CandidateType = "skill_match" | "growth" | "load_balance";

export interface Organization {
  id: string;
  name: string;
  managerUid: string;
  managerName: string;
  inviteCode: string;
  scoringWeights?: ScoringWeights;
  evaluationHistory?: EvaluationHistoryEntry[];
}

export interface ScoringWeights {
  requirement: number;
  clarity: number;
  completeness: number;
}

export interface EvaluationHistoryEntry {
  taskId: string;
  aiScore: number;
  managerScore: number;
  aiBreakdown: {
    requirement: number;
    clarity: number;
    completeness: number;
  };
  timestamp: Timestamp;
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
    ci_cd: number;
  };
  orgId?: string;
}

export interface TaskEvaluation {
  aiBreakdown: {
    requirement: number;
    clarity: number;
    completeness: number;
  };
  aiScore: number;
  aiFeedback: string;
  managerScore?: number;
  managerComment?: string;
  finalScore: number;
  delta: number;
  level: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  requiredSkill?: RequiredSkill;
  deadline?: TaskDeadline;
  orgId?: string;
  assigneeUid: string;
  assigneeName: string;
  status: TaskStatus;
  createdAt: Timestamp;
  submission?: string;
  prUrl?: string;
  evaluation?: TaskEvaluation;
}

export interface Candidate {
  uid: string;
  name: string;
  badgeLevel: BadgeLevel;
  badgeScore: number;
  type: CandidateType;
  reason: string;
  skills: {
    documentation: number;
    communication: number;
    technical: number;
    ci_cd: number;
  };
}

export interface TaskCandidates {
  taskIndex: number;
  taskTitle: string;
  requiredSkill: RequiredSkill;
  candidates: Candidate[];
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
  candidateType?: CandidateType;
}

export interface SelectedAssignment {
  taskIndex: number;
  assigneeUid: string;
  assigneeName: string;
  candidateType: CandidateType;
}

export interface SessionMessage {
  role: "user" | "model";
  content: string;
}

export interface Session {
  id: string;
  managerUid: string;
  orgId?: string;
  originalInstruction: string;
  clarifiedTasks: ClarifiedTask[];
  assignmentProposal: Assignment[];
  candidateProposals?: TaskCandidates[];
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
