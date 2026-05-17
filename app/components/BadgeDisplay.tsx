import type { BadgeLevel } from "@/types";

const LEVEL_CONFIG: Record<
  BadgeLevel,
  { emoji: string; color: string; bar: string; ring: string; bg: string; min: number; max: number | null }
> = {
  見習い:     { emoji: "⬜", color: "text-gray-600",   bar: "bg-gray-400",   ring: "ring-gray-300",   bg: "bg-gray-50",   min: 0,   max: 199  },
  初級:       { emoji: "🟢", color: "text-green-700",  bar: "bg-green-500",  ring: "ring-green-400",  bg: "bg-green-50",  min: 200, max: 399  },
  中級:       { emoji: "🔵", color: "text-blue-700",   bar: "bg-blue-500",   ring: "ring-blue-400",   bg: "bg-blue-50",   min: 400, max: 599  },
  上級:       { emoji: "⭐", color: "text-purple-700", bar: "bg-purple-500", ring: "ring-purple-400", bg: "bg-purple-50", min: 600, max: 799  },
  エキスパート: { emoji: "🏆", color: "text-yellow-600", bar: "bg-yellow-500", ring: "ring-yellow-400", bg: "bg-yellow-50", min: 800, max: null },
};

interface Props {
  level: BadgeLevel;
  score: number;
  size?: "sm" | "md" | "lg";
}

export default function BadgeDisplay({ level, score, size = "md" }: Props) {
  const cfg = LEVEL_CONFIG[level];
  const progress =
    cfg.max !== null
      ? Math.min(100, ((score - cfg.min) / (cfg.max - cfg.min + 1)) * 100)
      : 100;
  const remaining = cfg.max !== null ? cfg.max + 1 - score : 0;

  const iconSize = { sm: "w-12 h-12 text-2xl", md: "w-16 h-16 text-3xl", lg: "w-24 h-24 text-5xl" }[size];
  const nameSize = { sm: "text-sm", md: "text-lg", lg: "text-2xl" }[size];

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div
        className={`${iconSize} rounded-full ring-4 ${cfg.ring} ${cfg.bg} flex items-center justify-center shadow-md`}
      >
        <span>{cfg.emoji}</span>
      </div>
      <p className={`font-bold ${nameSize} ${cfg.color}`}>{level}</p>
      <p className="text-sm text-gray-400 font-mono">{score.toLocaleString()} pt</p>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full ${cfg.bar} transition-all duration-700`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {cfg.max !== null ? (
        <p className="text-xs text-gray-400">
          次のレベルまで <span className="font-semibold text-gray-600">{remaining} pt</span>
        </p>
      ) : (
        <p className="text-xs text-yellow-600 font-semibold">最高レベル達成！</p>
      )}
    </div>
  );
}
