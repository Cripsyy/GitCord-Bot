import type { Guild, LeaderboardEntry } from "../types";
import { getLevelProgress } from "../lib/xp";
import GitHubAvatar from "./GitHubAvatar";

type PodiumProps = {
  entries: LeaderboardEntry[];
  guilds: Guild[];
};

const MEDAL_TEXT_CLASSES = ["text-[#FFD700]", "text-[#C0C0C0]", "text-[#CD7F32]"];
const MEDAL_BG_CLASSES = ["bg-[#FFD700]", "bg-[#C0C0C0]", "bg-[#CD7F32]"];

export default function Podium({ entries, guilds }: PodiumProps) {
  if (entries.length === 0) return null;

  // Reorder to [2nd, 1st, 3rd] for the visual layout
  const slots: { entry: LeaderboardEntry; index: number }[] = [];
  if (entries.length >= 2) slots.push({ entry: entries[1], index: 1 });
  slots.push({ entry: entries[0], index: 0 });
  if (entries.length >= 3) slots.push({ entry: entries[2], index: 2 });

  const colCount = slots.length;

  return (
    <div
      className={`grid gap-3 sm:gap-5 items-end ${
        colCount === 3
          ? "grid-cols-3"
          : colCount === 2
          ? "grid-cols-2 max-w-sm mx-auto"
          : "grid-cols-1 max-w-[240px] mx-auto"
      }`}
    >
      {slots.map(({ entry, index }) => {
        const guildName = guilds.find((g) => String(g.id) === entry.guild_id)?.name;
        const isFirst = index === 0;
        const { surplus, needed, progress } = getLevelProgress(entry.xp, entry.level);

        return (
          <div
            key={entry.id}
            className={`flex flex-col items-center min-w-0 ${isFirst ? "z-10" : "z-0"}`}
          >
            {/* Avatar */}
            <GitHubAvatar
              username={entry.github_user}
              sizeClass="h-16 w-16 text-lg"
              fallback={index + 1}
            />

            {/* Username */}
            <p className="text-sm font-semibold text-discord-200 text-center truncate w-full px-2">
              {entry.github_user}
            </p>
            <p className="text-[11px] text-discord-500 text-center truncate w-full px-2 mb-2">
              {guildName ?? `Guild ${entry.guild_id}`}
            </p>

            {/* Podium block */}
            <div
              className={`w-full rounded-xl border border-white/5 bg-discord-850 flex flex-col items-center justify-start text-center px-4 pt-5 pb-4 shadow-soft ${
                isFirst ? "h-[180px]" : "h-[140px]"
              }`}
            >
              {/* Place number */}
              <span
                className={`text-3xl font-bold font-display leading-none ${MEDAL_TEXT_CLASSES[index]}`}
              >
                {index + 1}
              </span>

              <span className="text-[10px] uppercase tracking-wider text-discord-500 mt-1">
                Place
              </span>

              {/* XP */}
              <div className="mt-3 flex items-baseline gap-1">
                <p className="text-lg font-bold text-discord-200 leading-none">
                  {entry.xp.toLocaleString()}
                </p>
                <p className="text-[10px] text-discord-500">XP</p>
              </div>

              {/* Level progress */}
              <div className="mt-auto w-full">
                <div className="flex justify-between text-[10px] text-discord-500 mb-1">
                  <span>Level {entry.level}</span>
                  <span>
                    {surplus} / {needed}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-discord-900/80">
                  <div
                    className={`h-full rounded-full ${MEDAL_BG_CLASSES[index]}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
