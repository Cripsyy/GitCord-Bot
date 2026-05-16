import { useEffect, useState } from "react";
import type { Guild, LeaderboardConfig, LeaderboardRoleMilestone } from "../types";
import Navbar from "../components/Navbar";
import SearchDropdown from "../components/SearchDropdown";
import { fetchJson } from "../lib/api";

const XP_EVENTS = [
  { key: "push", label: "Push" },
  { key: "pull_request.opened", label: "PR Opened" },
  { key: "pull_request.reviewed", label: "PR Reviewed" },
  { key: "pull_request.closed", label: "PR Merged/Closed" },
  { key: "issues.opened", label: "Issue Opened" },
] as const;

const defaultXpSettings: Record<string, number> = {
  push: 10,
  "pull_request.opened": 30,
  "pull_request.reviewed": 20,
  "pull_request.closed": 50,
  "issues.opened": 25,
};

const defaultMilestones: LeaderboardRoleMilestone[] = [
  { level: 5, role_name: "Level 5", remove_previous: true },
  { level: 10, role_name: "Level 10", remove_previous: true },
  { level: 20, role_name: "Level 20", remove_previous: true },
];

function LeaderboardConfigPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [config, setConfig] = useState<LeaderboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedGuild, setSelectedGuild] = useState("");

  const [enabled, setEnabled] = useState(true);
  const [xpSettings, setXpSettings] = useState<Record<string, number>>(defaultXpSettings);
  const [enabledEvents, setEnabledEvents] = useState<Set<string>>(new Set(Object.keys(defaultXpSettings)));
  const [milestones, setMilestones] = useState<LeaderboardRoleMilestone[]>(defaultMilestones);

  async function loadGuilds() {
    try {
      const guildsData = await fetchJson<Guild[]>("/api/dashboard/guilds");
      setGuilds(guildsData);
    } catch (error) {
      setStatusMessage(`Error loading guilds: ${(error as Error).message}`);
    }
  }

  async function loadConfig(guildId: string) {
    setLoading(true);
    try {
      const configData = await fetchJson<LeaderboardConfig | null>(
        `/api/dashboard/leaderboard/config?guild_id=${guildId}`
      );
      if (configData) {
        setConfig(configData);
        setEnabled(configData.enabled);
        setXpSettings({ ...defaultXpSettings, ...configData.xp_settings });
        setEnabledEvents(new Set(Object.keys(configData.xp_settings)));
        setMilestones(configData.role_milestones);
      } else {
        setConfig(null);
        setEnabled(true);
        setXpSettings(defaultXpSettings);
        setEnabledEvents(new Set(Object.keys(defaultXpSettings)));
        setMilestones(defaultMilestones);
      }
    } catch (error) {
      setStatusMessage(`Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGuilds();
  }, []);

  useEffect(() => {
    if (selectedGuild) loadConfig(selectedGuild);
  }, [selectedGuild]);

  function toggleEventEnabled(key: string) {
    setEnabledEvents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function updateMilestone(index: number, field: keyof LeaderboardRoleMilestone, value: unknown) {
    setMilestones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addMilestone() {
    const maxLevel = milestones.reduce((max, m) => Math.max(max, m.level), 0);
    setMilestones((prev) => [
      ...prev,
      { level: maxLevel + 5, role_name: `Level ${maxLevel + 5}`, remove_previous: true },
    ]);
  }

  function removeMilestone(index: number) {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!selectedGuild) return;
    setSaving(true);
    setStatusMessage("");
    try {
      const filteredXpSettings: Record<string, number> = {};
      for (const key of enabledEvents) {
        filteredXpSettings[key] = xpSettings[key] ?? defaultXpSettings[key] ?? 0;
      }

      const response = await fetch("/api/dashboard/leaderboard/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guild_id: selectedGuild,
          enabled,
          xp_settings: filteredXpSettings,
          role_milestones: milestones,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      setStatusMessage("Saved");
    } catch (error) {
      setStatusMessage(`Error: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  const guildOptions = guilds.map((g) => ({
    value: g.id,
    label: g.name ?? `Guild ${g.id}`,
  }));

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Navbar title="Leaderboard Configuration" />

      <main className="flex-1 overflow-y-auto space-y-4 px-6 py-6">
        {statusMessage ? (
          <p className="text-sm text-discord-400">{statusMessage}</p>
        ) : null}

        <div className="max-w-sm">
          <SearchDropdown
            label="Server"
            items={guildOptions}
            selected={selectedGuild}
            onSelect={(value) => setSelectedGuild(value)}
            placeholder="Select a server"
          />
        </div>

        {!selectedGuild ? (
          <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-8 text-center shadow-soft">
            <p className="text-sm text-discord-500">Select a server to configure its leaderboard settings.</p>
          </div>
        ) : loading ? (
          <p className="text-sm text-discord-500">Loading...</p>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-5 shadow-soft">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-discord-200">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded border-white/10"
                />
                Enable Leaderboard XP Tracking
              </label>
            </div>

            <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-5 shadow-soft">
              <h3 className="font-display text-base text-discord-200">XP Settings</h3>
              <p className="mt-1 text-xs text-discord-500">
                Enable or disable XP awards per event type. Disabled events will not award XP.
              </p>
              <div className="mt-4 space-y-2">
                {XP_EVENTS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3 rounded-xl border border-white/5 bg-discord-900 px-4 py-2.5">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={enabledEvents.has(key)}
                        onChange={() => toggleEventEnabled(key)}
                        className="rounded border-white/10"
                      />
                      <span className="min-w-[140px] text-sm text-discord-400">{label}</span>
                    </label>
                    <input
                      type="number"
                      value={xpSettings[key] ?? 0}
                      onChange={(e) =>
                        setXpSettings((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                      }
                      min={0}
                      className="w-24 rounded-lg border border-white/10 bg-discord-850 px-3 py-2 text-sm text-discord-200 outline-none focus:border-discord-blurple"
                      disabled={!enabledEvents.has(key)}
                    />
                    <span className="text-xs text-discord-500">XP</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-5 shadow-soft">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base text-discord-200">Role Milestones</h3>
                <button
                  type="button"
                  onClick={addMilestone}
                  className="rounded-lg border border-white/10 bg-discord-800 px-3 py-1.5 text-xs text-discord-400 hover:text-discord-200"
                >
                  + Add Milestone
                </button>
              </div>
              <p className="mt-1 text-xs text-discord-500">
                Roles assigned when a user reaches a level.
              </p>
              <div className="mt-4 space-y-3">
                {milestones.map((m, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-discord-900 px-4 py-3">
                    <label className="text-xs text-discord-500">
                      Level
                      <input
                        type="number"
                        value={m.level}
                        onChange={(e) => updateMilestone(i, "level", Number(e.target.value))}
                        min={1}
                        className="ml-2 w-16 rounded-lg border border-white/10 bg-discord-850 px-2 py-1.5 text-sm text-discord-200 outline-none focus:border-discord-blurple"
                      />
                    </label>
                    <label className="text-xs text-discord-500">
                      Role Name
                      <input
                        type="text"
                        value={m.role_name}
                        onChange={(e) => updateMilestone(i, "role_name", e.target.value)}
                        className="ml-2 w-40 rounded-lg border border-white/10 bg-discord-850 px-2 py-1.5 text-sm text-discord-200 outline-none focus:border-discord-blurple"
                      />
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-discord-400">
                      <input
                        type="checkbox"
                        checked={m.remove_previous}
                        onChange={(e) => updateMilestone(i, "remove_previous", e.target.checked)}
                        className="rounded border-white/10"
                      />
                      Remove previous
                    </label>
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
                      className="text-xs text-discord-500 hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default LeaderboardConfigPage;
