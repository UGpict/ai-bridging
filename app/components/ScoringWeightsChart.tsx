"use client";

import { motion } from "framer-motion";
import type { ScoringWeights } from "@/types";

// Firestoreの Timestamp クラスを含まないシリアライズ可能な型
interface HistoryEntry {
  taskId: string;
  aiScore: number;
  managerScore: number;
  aiBreakdown: { requirement: number; clarity: number; completeness: number };
}

interface Props {
  weights: ScoringWeights;
  history: HistoryEntry[];
}

const ITEMS = [
  { key: "requirement" as const, label: "要件充足", max: 1.5, color: "from-indigo-400 to-violet-500" },
  { key: "clarity" as const, label: "明確性", max: 1.5, color: "from-amber-400 to-orange-500" },
  { key: "completeness" as const, label: "完結性", max: 1.5, color: "from-emerald-400 to-green-500" },
] as const;

function weightToLabel(w: number): string {
  if (w >= 1.3) return "非常に重視";
  if (w >= 1.1) return "やや重視";
  if (w <= 0.7) return "やや軽視";
  if (w <= 0.85) return "軽視";
  return "標準";
}

function buildSummary(weights: ScoringWeights): string {
  const parts: string[] = [];
  if (weights.requirement >= 1.1)
    parts.push(`要件充足を重視（+${Math.round((weights.requirement - 1) * 100)}%）`);
  if (weights.clarity >= 1.1)
    parts.push(`明確性を重視（+${Math.round((weights.clarity - 1) * 100)}%）`);
  if (weights.completeness >= 1.1)
    parts.push(`完結性を重視（+${Math.round((weights.completeness - 1) * 100)}%）`);
  if (parts.length === 0) return "まだ特定の傾向はありません";
  return "直近の採点傾向: " + parts.join("、");
}

export default function ScoringWeightsChart({ weights, history }: Props) {
  const hasEnoughHistory = history.length >= 5;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">採点傾向 AI学習</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {hasEnoughHistory
              ? buildSummary(weights)
              : `学習には評価履歴が5件以上必要です（現在${history.length}件）`}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 text-indigo-600 font-semibold">
          {history.length}件の評価から学習
        </span>
      </div>

      <div className="space-y-3">
        {ITEMS.map((item) => {
          const w = weights[item.key];
          const pct = ((w - 0.5) / (item.max - 0.5)) * 100;
          const neutralPct = ((1.0 - 0.5) / (item.max - 0.5)) * 100; // 標準値（1.0）の位置

          return (
            <div key={item.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    w >= 1.1 ? "bg-indigo-50 text-indigo-700" :
                    w <= 0.9 ? "bg-red-50 text-red-600" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {weightToLabel(w)}
                  </span>
                  <span className="text-xs font-black text-gray-700 w-10 text-right">
                    {w.toFixed(2)}x
                  </span>
                </div>
              </div>
              <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                {/* 標準値マーカー */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-gray-300 z-10"
                  style={{ left: `${neutralPct}%` }}
                />
                {/* 重みバー */}
                <motion.div
                  initial={{ width: `${neutralPct}%` }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 font-medium mb-2">直近の評価差分</p>
          <div className="flex gap-2 flex-wrap">
            {history.slice(0, 5).map((entry, i) => {
              const diff = entry.managerScore - entry.aiScore;
              return (
                <div
                  key={i}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    diff > 0
                      ? "bg-green-50 text-green-700"
                      : diff < 0
                      ? "bg-red-50 text-red-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {diff > 0 ? "+" : ""}{diff}pt
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
