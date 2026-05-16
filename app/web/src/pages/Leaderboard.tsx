import { useEffect, useState } from "react";
import type { Guild, LeaderboardEntry } from "../types";
import Navbar from "../components/Navbar";
import Podium from "../components/Podium";
import ConfigView from "../components/ConfigView";
import type { SortDef } from "../components/ConfigView";
import { SearchIcon, ListIcon, GridIcon } from "../components/Icons";
import { fetchJson } from "../lib/api";

type ViewMode = "list" | "grid";

function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [guildFilter, setGuildFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("xp");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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

  const sortDefs: SortDef<LeaderboardEntry>[] = [
    {
      value: "xp",
      label: "XP",
      compare: (a, b) => b.xp - a.xp,
    },
    {
      value: "level",
      label: "Level",
      compare: (a, b) => b.level - a.level,
    },
    {
      value: "user",
      label: "User",
      compare: (a, b) => (a.github_user ?? "").localeCompare(b.github_user ?? ""),
    },
  ];

  const podiumEntries = entries.slice(0, 3);
  const remainingEntries = entries.slice(3);

  function getSearchText(entry: LeaderboardEntry): string {
    return `${entry.github_user} ${entry.user_name ?? ""} ${entry.guild_id}`;
  }

  const guildOptions = guilds.map((g) => ({
    value: g.id,
    label: g.name ?? `Guild ${g.id}`,
  }));

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Navbar title="Leaderboard" />

      <main className="flex-1 overflow-y-auto space-y-4 px-6 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={guildFilter}
              onChange={(e) => setGuildFilter(e.target.value)}
              className="appearance-none rounded-lg border border-white/10 bg-discord-900 px-8 py-2 text-sm text-discord-200 outline-none focus:border-discord-blurple"
            >
              <option value="">All Servers</option>
              {guildOptions.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-discord-500">▾</span>
          </div>

          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-discord-500">
              <SearchIcon />
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by user..."
              className="w-full rounded-lg border border-white/10 bg-discord-900 py-2 pl-9 pr-3 text-sm text-discord-200 outline-none placeholder:text-discord-500 focus:border-discord-blurple"
            />
          </div>

          <div className="relative">
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="appearance-none rounded-lg border border-white/10 bg-discord-900 px-8 py-2 text-sm text-discord-200 outline-none focus:border-discord-blurple"
            >
              {sortDefs.map((def) => (
                <option key={def.value} value={def.value}>
                  Sort: {def.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-discord-500">▾</span>
          </div>

          <div className="flex items-center overflow-hidden rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-2.5 py-2 ${
                viewMode === "list"
                  ? "bg-discord-blurple text-white"
                  : "bg-discord-800 text-discord-400 hover:text-discord-200"
              }`}
              title="List view"
            >
              <ListIcon />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-2 ${
                viewMode === "grid"
                  ? "bg-discord-blurple text-white"
                  : "bg-discord-800 text-discord-400 hover:text-discord-200"
              }`}
              title="Grid view"
            >
              <GridIcon />
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white"
          >
            Refresh
          </button>
        </div>

        {statusMessage ? (
          <p className="text-sm text-discord-400">{statusMessage}</p>
        ) : null}

        {loading ? (
          <p className="text-sm text-discord-500">Loading...</p>
        ) : (
          <>
            <Podium entries={podiumEntries} guilds={guilds} />

            <ConfigView
              items={remainingEntries}
              sortDefs={sortDefs}
              getSearchText={getSearchText}
              hideToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortField={sortField}
              onSortChange={setSortField}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              renderItem={(entry) => {
                const guildName = guilds.find((g) => String(g.id) === entry.guild_id)?.name;
                const rank = entries.indexOf(entry) + 1;
                return (
                  <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-4 shadow-soft">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-discord-800 text-sm font-bold text-discord-200">
                        {rank.toString()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base text-discord-200 truncate">{entry.github_user}</p>
                        <p className="text-xs text-discord-400">
                          {guildName ?? `Guild ${entry.guild_id}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-lg text-discord-200">Level {entry.level}</p>
                        <p className="text-xs text-discord-500">{entry.xp.toLocaleString()} XP</p>
                      </div>
                    </div>
                  </div>
                );
              }}
              emptyMessage="No leaderboard entries yet. Data will appear once GitHub webhook events are processed."
            />
          </>
        )}
      </main>
    </div>
  );
}

export default Leaderboard;
