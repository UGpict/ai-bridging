"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddMemberButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [skills, setSkills] = useState({ documentation: 50, communication: 50, technical: 50, ci_cd: 50 });

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, skills }),
      });
      const data = await res.json() as { uid?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "追加に失敗しました");
      setOpen(false);
      setName("");
      setEmail("");
      setSkills({ documentation: 50, communication: 50, technical: 50, ci_cd: 50 });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        メンバー追加
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">メンバーを追加</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">名前</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="田中太郎"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">メールアドレス</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="tanaka@example.com"
                />
              </div>

              {(
                [
                  { key: "documentation", label: "資料作成" },
                  { key: "communication", label: "調整・折衝" },
                  { key: "technical", label: "技術" },
                  { key: "ci_cd", label: "CI/CD" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-700 flex justify-between">
                    <span>{label}</span>
                    <span className="text-indigo-600">{skills[key]}</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={skills[key]}
                    onChange={(e) => setSkills((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="mt-1 w-full accent-indigo-600"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !name.trim()}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "追加中..." : "追加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
