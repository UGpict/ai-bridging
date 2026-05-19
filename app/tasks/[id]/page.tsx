"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import type { Task, BadgeLevel } from "@/types";
import Header from "@/app/components/Header";
import LevelUpModal from "@/app/components/LevelUpModal";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [submission, setSubmission] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState("");
  const [prevLevel, setPrevLevel] = useState<BadgeLevel | null>(null);
  const [levelUpData, setLevelUpData] = useState<{
    from: BadgeLevel;
    to: BadgeLevel;
    delta: number;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [taskRes, userRes] = await Promise.all([
          fetch(`/api/tasks/${id}`),
          fetch("/api/auth/me"),
        ]);
        const taskData = (await taskRes.json()) as Task;
        setTask(taskData);
        if (taskData.submission) setSubmission(taskData.submission);
        if (taskData.prUrl) setPrUrl(taskData.prUrl);
        if (userRes.ok) {
          const userData = (await userRes.json()) as { badgeLevel: BadgeLevel };
          setPrevLevel(userData.badgeLevel);
        }
      } catch {
        setError("読み込みに失敗しました");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [id]);

  const handleSubmit = async () => {
    if (!submission.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission, prUrl: prUrl.trim() || undefined }),
      });
      if (!res.ok) throw new Error("提出に失敗しました");
      const updated = (await res.json()) as Task;
      setTask(updated);

      setEvaluating(true);
      const evalRes = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id }),
      });
      if (!evalRes.ok) throw new Error("評価に失敗しました");
      const evalData = (await evalRes.json()) as {
        aiScore: number;
        aiFeedback: string;
        finalScore: number;
        delta: number;
        level: string;
      };

      setTask((prev) =>
        prev
          ? {
              ...prev,
              status: "ai_evaluated",
              evaluation: {
                aiBreakdown: { requirement: 0, clarity: 0, completeness: 0 },
                aiScore: evalData.aiScore,
                aiFeedback: evalData.aiFeedback,
                finalScore: evalData.finalScore,
                delta: evalData.delta,
                level: evalData.level,
              },
            }
          : prev
      );

      if (prevLevel && evalData.level !== prevLevel) {
        setLevelUpData({
          from: prevLevel,
          to: evalData.level as BadgeLevel,
          delta: evalData.delta,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setSubmitting(false);
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">{error || "タスクが見つかりません"}</p>
      </div>
    );
  }

  const isDone = task.status === "ai_evaluated" || task.status === "evaluated";
  const showFeedback = isDone && task.evaluation;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header pageTitle="タスク詳細" backHref="/tasks" />

      {levelUpData && (
        <LevelUpModal
          from={levelUpData.from}
          to={levelUpData.to}
          delta={levelUpData.delta}
          onClose={() => setLevelUpData(null)}
        />
      )}

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Task info */}
        <div className={`bg-white rounded-xl border p-6 ${task.deadline === "today" ? "border-red-300" : "border-gray-200"}`}>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {task.deadline === "today" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600">🔥 今日中</span>
            )}
            <h2 className="text-lg font-semibold text-gray-900">{task.title}</h2>
          </div>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">{task.description}</p>
        </div>

        {/* Evaluation feedback (after AI evaluation) */}
        {showFeedback && (
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-6">
            <h3 className="font-semibold text-indigo-900 mb-3">フィードバック</h3>

            {task.status === "ai_evaluated" ? (
              <div className="flex items-center gap-3 mb-4 bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
                <span className="text-lg">⏳</span>
                <p className="text-sm text-violet-700 font-medium">
                  上司のレビュー待ちです。確定スコアは評価後に反映されます。
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-6 mb-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-indigo-600">{task.evaluation!.finalScore}</p>
                  <p className="text-xs text-indigo-400">/ 100点</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    スコア変動:{" "}
                    <span className={task.evaluation!.delta >= 0 ? "text-green-600" : "text-red-600"}>
                      {task.evaluation!.delta >= 0 ? "+" : ""}
                      {task.evaluation!.delta}pt
                    </span>
                  </p>
                  <p className="text-sm font-medium text-gray-600">
                    バッジレベル:{" "}
                    <span className="text-indigo-600 font-semibold">{task.evaluation!.level}</span>
                  </p>
                </div>
              </div>
            )}

            <p className="text-sm text-gray-700 leading-relaxed">{task.evaluation!.aiFeedback}</p>
          </div>
        )}

        {/* Submission */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-3">成果物の提出</h3>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              GitHub PR / Issue URL（任意）
            </label>
            {isDone && task.prUrl ? (
              <a
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 underline break-all"
              >
                {task.prUrl}
              </a>
            ) : (
              <input
                type="url"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                disabled={isDone || submitting || evaluating}
                placeholder="https://github.com/org/repo/pull/123"
                className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            )}
          </div>
          <textarea
            value={submission}
            onChange={(e) => setSubmission(e.target.value)}
            disabled={isDone || submitting || evaluating}
            placeholder="成果物の内容をここに記入してください..."
            rows={8}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
          />
          {!isDone && (
            <button
              onClick={handleSubmit}
              disabled={!submission.trim() || submitting || evaluating}
              className="mt-3 w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
            >
              {evaluating ? "✨ AIが評価中..." : submitting ? "提出中..." : "提出してAI評価を受ける →"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
