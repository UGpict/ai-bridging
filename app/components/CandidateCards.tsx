"use client";

import { motion } from "framer-motion";
import type { Candidate, CandidateType, TaskCandidates } from "@/types";

const TYPE_META: Record<
  CandidateType,
  { label: string; icon: string; color: string; border: string; glow: string }
> = {
  skill_match: {
    label: "スキルマッチ",
    icon: "⚔️",
    color: "text-indigo-700",
    border: "border-indigo-300",
    glow: "shadow-indigo-200",
  },
  growth: {
    label: "成長機会",
    icon: "🌱",
    color: "text-emerald-700",
    border: "border-emerald-300",
    glow: "shadow-emerald-200",
  },
  load_balance: {
    label: "負荷分散",
    icon: "⚖️",
    color: "text-amber-700",
    border: "border-amber-300",
    glow: "shadow-amber-200",
  },
};

const BADGE_COLORS: Record<string, string> = {
  見習い: "bg-gray-100 text-gray-600",
  初級: "bg-green-100 text-green-700",
  中級: "bg-blue-100 text-blue-700",
  上級: "bg-purple-100 text-purple-700",
  エキスパート: "bg-yellow-100 text-yellow-700",
};

const SKILL_LABELS: Record<string, string> = {
  documentation: "資料",
  communication: "調整",
  technical: "技術",
  ci_cd: "CI/CD",
};

interface CandidateCardProps {
  candidate: Candidate;
  index: number;
  isSelected: boolean;
  requiredSkill: string;
  onSelect: (uid: string) => void;
}

function CandidateCard({
  candidate,
  index,
  isSelected,
  requiredSkill,
  onSelect,
}: CandidateCardProps) {
  const meta = TYPE_META[candidate.type];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: index * 0.12, duration: 0.3, ease: "easeOut" }}
      onClick={() => onSelect(candidate.uid)}
      className={`cursor-pointer rounded-2xl border-2 p-4 transition-all select-none
        ${isSelected
          ? `${meta.border} bg-white shadow-lg ${meta.glow} scale-105`
          : "border-gray-100 bg-white hover:border-gray-300 hover:shadow-md"
        }`}
    >
      {/* Type badge */}
      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold mb-3
        ${isSelected ? `bg-white border ${meta.border} ${meta.color}` : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
      </div>

      {/* Member name + badge */}
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-gray-900 text-base leading-tight">{candidate.name}</p>
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${BADGE_COLORS[candidate.badgeLevel] ?? "bg-gray-100 text-gray-600"}`}>
          {candidate.badgeLevel}
        </span>
      </div>

      {/* Reason */}
      <p className="text-xs text-gray-500 leading-relaxed mb-3">{candidate.reason}</p>

      {/* Skill bar for required skill */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-10 shrink-0">
          {SKILL_LABELS[requiredSkill] ?? requiredSkill}
        </span>
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, candidate.skills[requiredSkill as keyof typeof candidate.skills] ?? 0)}%` }}
            transition={{ delay: index * 0.12 + 0.25, duration: 0.5, ease: "easeOut" }}
            className={`h-1.5 rounded-full ${isSelected ? "bg-gradient-to-r from-indigo-400 to-violet-500" : "bg-gray-300"}`}
          />
        </div>
        <span className="text-xs text-gray-500 w-6 text-right">
          {candidate.skills[requiredSkill as keyof typeof candidate.skills] ?? 0}
        </span>
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 flex items-center justify-center gap-1 text-xs font-bold text-indigo-600"
        >
          <span>✓</span>
          <span>選択中</span>
        </motion.div>
      )}
    </motion.div>
  );
}

interface CandidateCardsProps {
  proposals: TaskCandidates[];
  selections: Record<number, string>; // taskIndex → selectedUid
  onSelect: (taskIndex: number, uid: string) => void;
}

export default function CandidateCards({
  proposals,
  selections,
  onSelect,
}: CandidateCardsProps) {
  return (
    <div className="space-y-6">
      {proposals.map((proposal) => (
        <div key={proposal.taskIndex}>
          {/* Task header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center shrink-0">
              {proposal.taskIndex + 1}
            </span>
            <p className="text-sm font-bold text-gray-800 leading-snug">{proposal.taskTitle}</p>
            {selections[proposal.taskIndex] && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="ml-auto text-xs text-emerald-600 font-semibold"
              >
                ✓ 確定
              </motion.span>
            )}
          </div>

          {/* 3 cards */}
          <div className="grid grid-cols-3 gap-3">
            {proposal.candidates.map((candidate, i) => (
              <CandidateCard
                key={candidate.uid}
                candidate={candidate}
                index={i}
                isSelected={selections[proposal.taskIndex] === candidate.uid}
                requiredSkill={proposal.requiredSkill}
                onSelect={(uid) => onSelect(proposal.taskIndex, uid)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
