"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Step = "loading" | "choose" | "create" | "join" | "success";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("loading");
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const user = (await res.json()) as { role: string };
          router.replace(user.role === "manager" ? "/dashboard" : "/tasks");
        } else if (res.status === 404) {
          setStep("choose");
        } else {
          router.replace("/login");
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  const handleCreate = async () => {
    if (!teamName.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", teamName }),
      });
      const data = (await res.json()) as { inviteCode?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "エラーが発生しました");
      setGeneratedCode(data.inviteCode ?? "");
      setStep("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (inviteCode.length < 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", inviteCode: inviteCode.trim().toUpperCase() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "エラーが発生しました");
      router.push("/tasks");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg font-bold">
            AI
          </div>
          <h1 className="text-xl font-bold text-gray-900">AI Bridging へようこそ</h1>
        </div>

        {step === "loading" && (
          <p className="text-sm text-gray-400">読み込み中...</p>
        )}

        {step === "choose" && (
          <>
            <p className="text-sm text-gray-500 text-center">
              チームを作成するか、既存のチームに参加してください
            </p>
            <div className="w-full space-y-3">
              <button
                onClick={() => setStep("create")}
                className="w-full border-2 border-indigo-200 rounded-xl p-5 text-left hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
              >
                <p className="font-semibold text-gray-900">チームを作る</p>
                <p className="text-sm text-gray-500 mt-1">
                  新しいチームを作成してマネージャーになります
                </p>
              </button>
              <button
                onClick={() => setStep("join")}
                className="w-full border-2 border-gray-200 rounded-xl p-5 text-left hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                <p className="font-semibold text-gray-900">チームに参加</p>
                <p className="text-sm text-gray-500 mt-1">
                  招待コードを入力してチームに参加します
                </p>
              </button>
            </div>
          </>
        )}

        {step === "create" && (
          <div className="w-full space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">チーム名</label>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="例：開発チームA"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep("choose"); setError(""); }}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                戻る
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !teamName.trim()}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "作成中..." : "チームを作成"}
              </button>
            </div>
          </div>
        )}

        {step === "join" && (
          <div className="w-full space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">招待コード</label>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="例：ABC123"
                maxLength={6}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-400">
                マネージャーから6文字の招待コードを受け取ってください
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep("choose"); setError(""); }}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                戻る
              </button>
              <button
                onClick={handleJoin}
                disabled={loading || inviteCode.length < 6}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "参加中..." : "チームに参加"}
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="w-full space-y-4 text-center">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm font-medium text-green-800">チームを作成しました</p>
              <p className="text-xs text-green-600 mt-0.5">
                以下の招待コードをメンバーに共有してください
              </p>
            </div>
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
              <p className="text-3xl font-bold font-mono tracking-widest text-indigo-700">
                {generatedCode}
              </p>
            </div>
            <button
              onClick={copyCode}
              className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              {copied ? "コピーしました" : "コードをコピー"}
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              ダッシュボードへ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
