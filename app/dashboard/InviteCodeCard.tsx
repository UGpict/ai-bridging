"use client";

import { useState } from "react";

export default function InviteCodeCard({ code, teamName }: { code: string; teamName: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-6 py-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-indigo-900">{teamName} の招待コード</p>
        <p className="text-xs text-indigo-500 mt-0.5">
          メンバーはこのコードでチームに参加できます
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-xl tracking-widest text-indigo-700">{code}</span>
        <button
          onClick={copy}
          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {copied ? "コピー済" : "コピー"}
        </button>
      </div>
    </div>
  );
}
