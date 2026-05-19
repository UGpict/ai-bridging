"use client";

import { useState } from "react";
import Confetti from "react-confetti";
import type { BadgeLevel } from "@/types";

const BADGE: Record<BadgeLevel, { emoji: string; gradient: string; text: string }> = {
  見習い:       { emoji: "⬜", gradient: "from-gray-400 to-gray-600",         text: "text-gray-600"   },
  初級:         { emoji: "🟢", gradient: "from-green-400 to-green-600",       text: "text-green-700"  },
  中級:         { emoji: "🔵", gradient: "from-blue-400 to-blue-600",         text: "text-blue-700"   },
  上級:         { emoji: "⭐", gradient: "from-purple-400 to-purple-600",     text: "text-purple-700" },
  エキスパート: { emoji: "🏆", gradient: "from-yellow-400 to-orange-500",     text: "text-yellow-600" },
};

const STARS: { top: string; left: string; color: string; tx: string; ty: string }[] = [
  { top: "8%",  left: "12%", color: "#6366f1", tx: "-35px", ty: "-60px" },
  { top: "6%",  left: "48%", color: "#a855f7", tx: "0px",   ty: "-70px" },
  { top: "8%",  left: "84%", color: "#ec4899", tx: "35px",  ty: "-60px" },
  { top: "48%", left: "3%",  color: "#8b5cf6", tx: "-65px", ty: "0px"   },
  { top: "48%", left: "94%", color: "#d946ef", tx: "65px",  ty: "0px"   },
  { top: "88%", left: "12%", color: "#6366f1", tx: "-35px", ty: "60px"  },
  { top: "90%", left: "48%", color: "#a855f7", tx: "0px",   ty: "70px"  },
  { top: "88%", left: "84%", color: "#ec4899", tx: "35px",  ty: "60px"  },
];

interface Props {
  from: BadgeLevel;
  to: BadgeLevel;
  delta: number;
  onClose: () => void;
}

export default function LevelUpModal({ from, to, delta, onClose }: Props) {
  const toC = BADGE[to];
  const fromC = BADGE[from];
  const [windowSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {windowSize.width > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={350}
          colors={["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#fff"]}
        />
      )}

      {/* Burst stars */}
      {STARS.map((s, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 rounded-full pointer-events-none"
          style={
            {
              top: s.top,
              left: s.left,
              background: s.color,
              animation: `star-float 1.3s ease-out ${i * 0.08}s both`,
              "--tx": s.tx,
              "--ty": s.ty,
            } as React.CSSProperties
          }
        />
      ))}

      {/* Card */}
      <div
        className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-xs mx-4 text-center"
        style={{ animation: "level-up-in 0.5s ease-out both" }}
      >
        <p className="text-4xl font-black tracking-widest bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          LEVEL UP!
        </p>

        <div className="flex items-center justify-center gap-6 my-8">
          <div className="text-center opacity-40">
            <span className="text-4xl">{fromC.emoji}</span>
            <p className="text-xs text-gray-400 mt-1">{from}</p>
          </div>
          <span className="text-2xl text-gray-300 font-bold">→</span>
          <div
            className="text-center"
            style={{ animation: "level-up-in 0.6s ease-out 0.25s both" }}
          >
            <span className="text-5xl">{toC.emoji}</span>
            <p className={`text-base font-bold mt-1 ${toC.text}`}>{to}</p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          <span className="text-green-600 font-bold text-xl">+{delta} pt</span> 獲得！
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl text-white font-bold text-base bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:opacity-90 transition-opacity active:scale-95"
        >
          やった！
        </button>
      </div>
    </div>
  );
}
