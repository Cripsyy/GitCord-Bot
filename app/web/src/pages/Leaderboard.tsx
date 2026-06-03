import { useEffect, useState } from "react";
import type { Guild, LeaderboardEntry } from "../types";
import Navbar from "../components/Navbar";
import Podium from "../components/Podium";
import { ConfigList } from "../components/ConfigView";
import { SearchIcon, ChevronIcon } from "../components/Icons";
import SearchDropdown from "../components/SearchDropdown";
import { getLevelProgress } from "../lib/xp";
import { fetchJson } from "../lib/api";
import GitHubAvatar from "../components/GitHubAvatar";
import { SkeletonCard, SkeletonLine, SkeletonCircle } from "../components/Skeleton";

function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [guildFilter, setGuildFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  async function loadData() {
    setLoading(true);
    try {
      const guildsData = await fetchJson<Guild[]>("/api/dashboard/guilds");
      setGuilds(guildsData);

      const params = new URLSearchParams();
      if (guildFilter) params.set("guild_id", guildFilter);
      const entriesData = await fetchJson<LeaderboardEntry[]>(
        `/api/dashboard/leaderboard${params.toString() ? `?${params.toString()}` : ""}`
      );
      setEntries(entriesData);
    } catch (error) {
      setStatusMessage(`Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (guilds.length) loadData();
  }, [guildFilter]);

  const podiumEntries = entries.slice(0, 3);
  const showPodium = entries.length >= 3;

  function getSearchText(entry: LeaderboardEntry): string {
    return `${entry.github_user} ${entry.user_name ?? ""} ${entry.guild_id}`;
  }

  const guildOptions = guilds.map((g) => ({
    value: g.id,
    label: g.name ?? `Guild ${g.id}`,
  }));

  const filteredEntries = entries.filter((entry) =>
    getSearchText(entry).toLowerCase().includes(searchQuery.toLowerCase())
  );

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Navbar title="Leaderboard" />

      <main className="flex-1 overflow-y-auto space-y-4 px-6 py-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-52">
            <SearchDropdown
              label=""
              items={guildOptions}
              selected={guildFilter}
              onSelect={(value) => setGuildFilter(value)}
              placeholder="All Servers"
            />
          </div>
          <div className="relative min-w-0 flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-discord-500">
              <SearchIcon />
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-white/10 bg-discord-900 py-2 pl-9 pr-3 text-sm text-discord-200 outline-none placeholder:text-discord-500 focus:border-discord-blurple"
            />
          </div>

          <button
            type="button"
            onClick={loadData}
            className="rounded-lg bg-discord-blurple px-4 py-2 text-sm font-semibold text-white hover:bg-discord-blurple/90 transition-colors"
          >
            Refresh
          </button>
        </div>

        {statusMessage ? (
          <p className="text-sm text-discord-400">{statusMessage}</p>
        ) : null}

        {loading ? (
          <>
            <div className="grid gap-3 sm:gap-5 items-end grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center min-w-0">
                  <SkeletonCircle size="h-16 w-16" />
                  <SkeletonLine className="mt-2 h-3 w-20" />
                  <SkeletonLine className="mt-1 mb-2 h-2.5 w-16" />
                  <div
                    className={`w-full rounded-xl border border-white/5 bg-discord-850 flex flex-col items-center justify-start text-center px-4 pt-5 pb-4 ${
                      i === 2 ? "h-[180px]" : "h-[140px]"
                    }`}
                  >
                    <SkeletonLine className="h-8 w-8" />
                    <SkeletonLine className="mt-1 h-2.5 w-10" />
                    <SkeletonLine className="mt-3 h-5 w-16" />
                    <div className="mt-auto w-full">
                      <SkeletonLine className="h-1.5 w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonCard key={i}>
                  <div className="flex items-center gap-4">
                    <SkeletonCircle size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <SkeletonLine className="h-4 w-40" />
                      <SkeletonLine className="mt-1 h-3 w-24" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <SkeletonLine className="h-5 w-16" />
                      <SkeletonLine className="h-3 w-20" />
                    </div>
                  </div>
                </SkeletonCard>
              ))}
            </div>
          </>
        ) : (
          <>
            {showPodium && <Podium entries={podiumEntries} guilds={guilds} />}

            {entries.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-8 text-center">
                <p className="text-sm text-discord-500">
                  No leaderboard entries yet. Data will appear once GitHub webhook events are processed.
                </p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-8 text-center">
                <p className="text-sm text-discord-500">No results match your search.</p>
              </div>
            ) : (
              <ConfigList>
                {filteredEntries.map((entry) => {
                  const guildName = guilds.find((g) => String(g.id) === entry.guild_id)?.name;
                  const rank = entries.indexOf(entry) + 1;
                  const isExpanded = expandedIds.has(entry.id);
                  const { surplus, needed, progress } = getLevelProgress(entry.xp, entry.level);

                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-4 shadow-soft cursor-pointer transition-colors hover:bg-discord-800/50"
                      onClick={() => toggleExpand(entry.id)}
                    >
                      <div className="flex items-center gap-4">
                        <GitHubAvatar
                          username={entry.github_user}
                          sizeClass="h-10 w-10 text-sm"
                          fallback={rank.toString()}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-base text-discord-200 truncate">
                            {entry.github_user}
                          </p>
                          <p className="text-xs text-discord-400">
                            {guildName ?? `Guild ${entry.guild_id}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-right">
                          <div>
                            <p className="font-display text-lg text-discord-200">
                              Level {entry.level}
                            </p>
                            <p className="text-xs text-discord-500">
                              {entry.xp.toLocaleString()} XP
                            </p>
                          </div>
                          <span className="text-discord-500">
                            <ChevronIcon open={isExpanded} />
                          </span>
                        </div>
                      </div>

                      {isExpanded ? (
                        <div className="mt-4 pt-4 border-t border-white/5">
                          <div className="flex justify-between text-xs text-discord-400 mb-1.5">
                            <span>Progress to Level {entry.level + 1}</span>
                            <span>
                              {surplus} / {needed} XP
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-discord-800">
                            <div
                              className="h-full rounded-full bg-discord-blurple transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-discord-500">
                            <span className="text-discord-200 font-semibold">
                              {needed - surplus}
                            </span>{" "}
                            more XP needed to reach Level {entry.level + 1}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </ConfigList>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Leaderboard;
