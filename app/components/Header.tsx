"use client";

import Link from "next/link";

const badgeLevelColors: Record<string, string> = {
  見習い: "text-gray-500",
  初級: "text-green-600",
  中級: "text-blue-600",
  上級: "text-purple-600",
  エキスパート: "text-yellow-600",
};

interface HeaderProps {
  pageTitle?: string;
  userName?: string;
  badgeInfo?: { level: string; score: number };
  backHref?: string;
  action?: { label: string; href: string };
}

export default function Header({
  pageTitle = "TascaLL",
  userName,
  badgeInfo,
  backHref,
  action,
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-100 px-6 py-3.5 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
          >
            ← 戻る
          </Link>
        ) : (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-black select-none bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-sm">
            TL
          </div>
        )}
        <h1 className="text-base font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {userName && (
          <div className={badgeInfo ? "text-right" : ""}>
            <p className="text-sm font-medium text-gray-800">{userName}</p>
            {badgeInfo && (
              <p className={`text-xs font-medium ${badgeLevelColors[badgeInfo.level] ?? "text-gray-500"}`}>
                {badgeInfo.level} · {badgeInfo.score}pt
              </p>
            )}
          </div>
        )}
        {action && (
          <Link
            href={action.href}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
          >
            {action.label}
          </Link>
        )}
      </div>
    </header>
  );
}
