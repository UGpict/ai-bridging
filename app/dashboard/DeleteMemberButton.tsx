"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteMemberButton({ uid, name }: { uid: string; name: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`${name} を削除しますか？この操作は元に戻せません。`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/members/${uid}`, { method: "DELETE" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "削除に失敗しました");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors"
    >
      {loading ? "削除中..." : "削除"}
    </button>
  );
}
