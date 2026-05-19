"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import type { Task } from "@/types";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";

const STATUS_LABEL: Record<string, string> = {
  pending: "進行中",
  submitted: "提出済",
  ai_evaluated: "AI評価済",
  evaluated: "確定済",
};

export default function ManagerTaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [managerScore, setManagerScore] = useState(70);
  const [managerComment, setManagerComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    finalScore: number;
    delta: number;
    level: string;
    aiFeedback: string;
    newWeights: { requirement: number; clarity: number; completeness: number };
  } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/tasks/${id}`);
        if (!res.ok) throw new Error("タスクの取得に失敗しました");
        setTask((await res.json()) as Task);
      } catch {
        setError("読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  // スライダーの色を動的に算出
  const sliderColor =
    managerScore >= 80
      ? "from-emerald-400 to-green-500"
      : managerScore >= 60
      ? "from-indigo-400 to-violet-500"
      : managerScore >= 40
      ? "from-amber-400 to-orange-500"
      : "from-red-400 to-rose-500";

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/evaluate/manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: id,
          managerScore,
          managerComment: managerComment.trim() || undefined,
        }),
      });
      const data = await res.json() as typeof result & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "評価に失敗しました");
      setResult(data);
      setTask((prev) => prev ? { ...prev, status: "evaluated" } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-500">{error || "タスクが見つかりません"}</p>
        </div>
      </div>
    );
  }

  const isAiEvaluated = task.status === "ai_evaluated";
  const isEvaluated = task.status === "evaluated";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div>
              <p className="text-xs text-gray-400 font-medium">Dashboard › タスク詳細</p>
              <h1 className="text-xl font-black text-gray-900 mt-0.5">{task.title}</h1>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
        </header>

        <main className="flex-1 p-6">
          <div className="max-w-2xl mx-auto space-y-5">

            {/* Task info */}
            <div className={`bg-white rounded-xl border p-6 ${task.deadline === "today" ? "border-red-200" : "border-gray-200"}`}>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {task.deadline === "today" && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">🔥 今日中</span>
                )}
                <span className="text-xs text-gray-400">担当: {task.assigneeName}</span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
            </div>

            {/* Submission */}
            {task.submission ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">提出内容</h3>
                {task.prUrl && (
                  <a
                    href={task.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 underline break-all block mb-3"
                  >
                    {task.prUrl}
                  </a>
                )}
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-4 border border-gray-100">
                  {task.submission}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                <p className="text-sm text-gray-400">まだ提出されていません</p>
              </div>
            )}

            {/* Manager evaluation */}
            {(isAiEvaluated || isEvaluated) && !result && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">あなたの評価</h3>
                <p className="text-xs text-gray-400 mb-5">
                  AIの採点結果は参考値として保存されます。あなたのスコアが部下のバッジに反映されます。
                </p>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
                    {error}
                  </div>
                )}

                {isEvaluated ? (
                  <div className="text-center py-4">
                    <p className="text-3xl font-black text-indigo-600">{task.evaluation?.finalScore ?? "—"}</p>
                    <p className="text-xs text-gray-400 mt-1">確定スコア</p>
                    {task.evaluation?.aiFeedback && (
                      <p className="text-sm text-gray-600 leading-relaxed mt-4 text-left">
                        {task.evaluation.aiFeedback}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Score slider */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-600">スコア</label>
                        <span className={`text-2xl font-black bg-gradient-to-r ${sliderColor} bg-clip-text text-transparent`}>
                          {managerScore}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={managerScore}
                        onChange={(e) => setManagerScore(Number(e.target.value))}
                        disabled={submitting}
                        className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-500 disabled:opacity-50"
                      />
                      <div className="flex justify-between text-xs text-gray-300 mt-1">
                        <span>0</span>
                        <span>50</span>
                        <span>100</span>
                      </div>
                    </div>

                    {/* Comment (optional) */}
                    <div className="mb-5">
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        コメント（任意）
                      </label>
                      <textarea
                        value={managerComment}
                        onChange={(e) => setManagerComment(e.target.value)}
                        disabled={submitting}
                        placeholder="部下へのフィードバックを入力..."
                        rows={3}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/50 resize-none disabled:opacity-50 bg-gray-50"
                      />
                    </div>

                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 text-white py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
                    >
                      {submitting ? "評価中..." : "評価を確定する →"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Result display */}
            {result && (
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl border border-indigo-200 p-6">
                <h3 className="font-semibold text-indigo-900 mb-4">評価を確定しました</h3>
                <div className="flex items-center gap-6 mb-4">
                  <div className="text-center">
                    <p className="text-4xl font-black text-indigo-600">{result.finalScore}</p>
                    <p className="text-xs text-indigo-400">確定スコア</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">
                      スコア変動:{" "}
                      <span className={result.delta >= 0 ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                        {result.delta >= 0 ? "+" : ""}{result.delta}pt
                      </span>
                    </p>
                    <p className="text-sm text-gray-600">
                      バッジレベル:{" "}
                      <span className="text-indigo-600 font-semibold">{result.level}</span>
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">{result.aiFeedback}</p>
                <div className="bg-white/60 rounded-lg p-3 border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-700 mb-2">採点重みを更新しました</p>
                  <div className="flex gap-4">
                    {(["requirement", "clarity", "completeness"] as const).map((k) => (
                      <div key={k} className="text-center">
                        <p className="text-sm font-black text-indigo-600">
                          {result.newWeights[k].toFixed(2)}x
                        </p>
                        <p className="text-xs text-gray-400">
                          {k === "requirement" ? "要件" : k === "clarity" ? "明確性" : "完結性"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
