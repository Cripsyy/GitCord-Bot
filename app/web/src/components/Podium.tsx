import type { Guild, LeaderboardEntry } from "../types";

type PodiumProps = {
  entries: LeaderboardEntry[];
  guilds: Guild[];
};

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];
const MEDAL_GLOWS = [
  "0 0 32px rgba(255,215,0,0.22), inset 0 0 8px rgba(255,215,0,0.12)",
  "0 0 24px rgba(192,192,192,0.16), inset 0 0 6px rgba(192,192,192,0.08)",
  "0 0 20px rgba(205,127,50,0.14), inset 0 0 6px rgba(205,127,50,0.06)",
];
const MEDAL_LABELS = ["1st", "2nd", "3rd"];

export default function Podium({ entries, guilds }: PodiumProps) {
  if (entries.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {entries.slice(0, 3).map((entry, i) => {
        const guildName = guilds.find((g) => String(g.id) === entry.guild_id)?.name;
        const medal = MEDAL_COLORS[i];
        const glow = MEDAL_GLOWS[i];
        const isFirst = i === 0;

        return (
          <div
            key={entry.id}
            className={`rounded-2xl border border-white/5 bg-discord-850 px-5 py-5 shadow-soft ${
              isFirst ? "sm:scale-[1.03] sm:ring-1 sm:ring-white/10" : ""
            }`}
            style={{ boxShadow: `${glow}, 0 18px 40px rgba(0,0,0,0.28)` }}
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex shrink-0 items-center justify-center rounded-full text-lg font-bold text-discord-900 ${
                  isFirst ? "h-14 w-14" : "h-12 w-12"
                }`}
                style={{ backgroundColor: medal }}
              >
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base text-discord-200 truncate">
                  {entry.github_user}
                </p>
                <p className="text-xs text-discord-400 truncate">
                  {guildName ?? `Guild ${entry.guild_id}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs uppercase tracking-wider text-discord-500">
                  {MEDAL_LABELS[i]}
                </p>
                <p className={`font-display text-lg text-discord-200 ${isFirst ? "mt-0.5" : ""}`}>
                  Level {entry.level}
                </p>
                <p className="text-xs text-discord-500">
                  {entry.xp.toLocaleString()} XP
                </p>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-discord-800">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: medal,
                  width: `${Math.min(100, ((entry.xp % 100) / 100) * 100 || 0)}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
