import { useEffect, useState } from "react";
import type { Guild, LeaderboardConfig, LeaderboardRoleMilestone } from "../types";
import Navbar from "../components/Navbar";
import ConfigView from "../components/ConfigView";
import type { SortDef } from "../components/ConfigView";
import Toggle from "../components/Toggle";
import CheckButton from "../components/CheckButton";
import NumberStepper from "../components/NumberStepper";
import Tooltip from "../components/Tooltip";
import Modal from "../components/Modal";
import FormError from "../components/FormError";
import { SkeletonCard, SkeletonLine } from "../components/Skeleton";
import { showError } from "../lib/toast";
import { api } from "../lib/api";

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
  { level: 5, role_name: "Level 5", remove_previous: true, color: "#1abc9c", hoist: true },
  { level: 10, role_name: "Level 10", remove_previous: true, color: "#3498db", hoist: true },
  { level: 20, role_name: "Level 20", remove_previous: true, color: "#9b59b6", hoist: true },
];

type PageData = {
  guilds: Guild[];
  configs: Record<string, LeaderboardConfig>;
};

function LeaderboardConfigPage() {
  const [data, setData] = useState<PageData>({ guilds: [], configs: {} });
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingGuild, setEditingGuild] = useState<Guild | null>(null);
  const [modalXpSettings, setModalXpSettings] = useState<Record<string, number>>(defaultXpSettings);
  const [modalEnabledEvents, setModalEnabledEvents] = useState<Set<string>>(new Set(Object.keys(defaultXpSettings)));
  const [modalMilestones, setModalMilestones] = useState<LeaderboardRoleMilestone[]>(defaultMilestones);
  const [modalRemovePrevious, setModalRemovePrevious] = useState(true);
  const [modalHoist, setModalHoist] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingMilestoneIdx, setEditingMilestoneIdx] = useState<number | null>(null);
  const [milestoneForm, setMilestoneForm] = useState<LeaderboardRoleMilestone>({
    level: 5, role_name: "Level 5", remove_previous: true, color: "#1abc9c", hoist: true,
  });

  async function loadData() {
    setLoading(true);
    try {
      const guilds = await api.get<Guild[]>("/api/dashboard/guilds");

      const configResults = await Promise.allSettled(
        guilds.map((g) =>
          api.get<LeaderboardConfig | null>(`/api/dashboard/leaderboard/config?guild_id=${g.id}`, { showError: false })
        )
      );

      const configs: Record<string, LeaderboardConfig> = {};
      configResults.forEach((result, i) => {
        if (result.status === "fulfilled" && result.value) {
          configs[guilds[i].id] = result.value;
        }
      });

      setData({ guilds, configs });
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openEdit(guild: Guild) {
    const existing = data.configs[guild.id];
    setEditingGuild(guild);
    setModalXpSettings(existing?.xp_settings ? { ...defaultXpSettings, ...existing.xp_settings } : { ...defaultXpSettings });
    setModalEnabledEvents(new Set(Object.keys(existing?.xp_settings ?? defaultXpSettings)));
    const milestonesData = existing?.role_milestones
      ? existing.role_milestones.map((m) => ({ ...m })).sort((a, b) => a.level - b.level)
      : defaultMilestones.map((m) => ({ ...m }));
    setModalMilestones(milestonesData);
    setModalRemovePrevious(milestonesData.length > 0 ? milestonesData[0].remove_previous : true);
    setModalHoist(milestonesData.length > 0 ? milestonesData[0].hoist : true);
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingGuild(null);
    setFormError("");
  }

  async function handleToggleEnabled(guildId: string, currentEnabled: boolean) {
    const existing = data.configs[guildId];
    const xpSettings = existing?.xp_settings ?? defaultXpSettings;
    const milestones = existing?.role_milestones ?? defaultMilestones;
    const newEnabled = !currentEnabled;

    await api.post("/api/dashboard/leaderboard/config", {
      guild_id: guildId,
      enabled: newEnabled,
      base_xp: existing?.base_xp ?? 100,
      start_increment: existing?.start_increment ?? 20,
      increment_step: existing?.increment_step ?? 10,
      xp_settings: xpSettings,
      role_milestones: milestones,
    }, {
      showSuccess: true,
      successMessage: newEnabled ? "Leaderboard enabled" : "Leaderboard disabled",
    });

    setData((prev) => ({
      ...prev,
      configs: {
        ...prev.configs,
        [guildId]: {
          id: existing?.id ?? "",
          guild_id: guildId,
          enabled: newEnabled,
          base_xp: existing?.base_xp ?? 100,
          start_increment: existing?.start_increment ?? 20,
          increment_step: existing?.increment_step ?? 10,
          xp_settings: xpSettings,
          role_milestones: milestones,
        },
      },
    }));
  }

  function toggleModalEvent(key: string) {
    setModalEnabledEvents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openAddMilestone() {
    const maxLevel = modalMilestones.reduce((max, m) => Math.max(max, m.level), 0);
    const palette = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#9b59b6", "#34495e"];
    const nextColor = palette[modalMilestones.length % palette.length];
    setMilestoneForm({
      level: maxLevel + 5,
      role_name: `Level ${maxLevel + 5}`,
      remove_previous: modalRemovePrevious,
      color: nextColor,
      hoist: modalHoist,
    });
    setEditingMilestoneIdx(null);
    setShowMilestoneModal(true);
  }

  function openEditMilestone(index: number) {
    setMilestoneForm({ ...modalMilestones[index] });
    setEditingMilestoneIdx(index);
    setShowMilestoneModal(true);
  }

  function closeMilestoneModal() {
    setShowMilestoneModal(false);
    setEditingMilestoneIdx(null);
  }

  function handleSaveMilestone() {
    setModalMilestones((prev) => {
      let next: LeaderboardRoleMilestone[];
      if (editingMilestoneIdx !== null) {
        next = [...prev];
        next[editingMilestoneIdx] = { ...milestoneForm };
      } else {
        next = [...prev, { ...milestoneForm }];
      }
      next.sort((a, b) => a.level - b.level);
      return next;
    });
    closeMilestoneModal();
  }

  function removeModalMilestone(index: number) {
    setModalMilestones((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!editingGuild) return;
    setSaving(true);
    setFormError("");
    try {
      const filteredXpSettings: Record<string, number> = {};
      for (const key of modalEnabledEvents) {
        filteredXpSettings[key] = modalXpSettings[key] ?? defaultXpSettings[key] ?? 0;
      }

      const existing = data.configs[editingGuild.id];
      const updatedMilestones = modalMilestones.map((m) => ({ ...m }));

      await api.post("/api/dashboard/leaderboard/config", {
        guild_id: editingGuild.id,
        enabled: existing?.enabled ?? true,
        base_xp: existing?.base_xp ?? 100,
        start_increment: existing?.start_increment ?? 20,
        increment_step: existing?.increment_step ?? 10,
        xp_settings: filteredXpSettings,
        role_milestones: updatedMilestones,
      }, {
        showSuccess: true,
        successMessage: "Leaderboard configuration saved",
        showError: false,
        onError: (err) => setFormError(err.message),
      });

      setData((prev) => ({
        ...prev,
        configs: {
          ...prev.configs,
          [editingGuild.id]: {
            id: existing?.id ?? "",
            guild_id: editingGuild.id,
            enabled: existing?.enabled ?? true,
            base_xp: existing?.base_xp ?? 100,
            start_increment: existing?.start_increment ?? 20,
            increment_step: existing?.increment_step ?? 10,
            xp_settings: filteredXpSettings,
            role_milestones: updatedMilestones,
          },
        },
      }));

      closeModal();
    } finally {
      setSaving(false);
    }
  }

  const leaderboardSortDefs: SortDef<Guild>[] = [
    {
      value: "name",
      label: "Name",
      compare: (a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id),
    },
    {
      value: "status",
      label: "Status",
      compare: (a, b) => {
        const aEnabled = data.configs[a.id]?.enabled ?? false;
        const bEnabled = data.configs[b.id]?.enabled ?? false;
        return aEnabled === bEnabled ? 0 : aEnabled ? -1 : 1;
      },
    },
  ];

  function getSearchText(guild: Guild): string {
    const config = data.configs[guild.id];
    const status = config ? (config.enabled ? "active" : "disabled") : "not configured";
    return `${guild.name ?? guild.id} ${status}`;
  }

  function renderCard(guild: Guild) {
    const config = data.configs[guild.id];
    const isEnabled = config?.enabled ?? false;
    const eventSummary = config?.xp_settings
      ? Object.entries(config.xp_settings)
          .map(([k, v]) => {
            const label = XP_EVENTS.find((e) => e.key === k)?.label ?? k;
            return `${label}(${v})`;
          })
          .join(", ")
      : null;

    return (
      <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-4 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-base text-discord-200 truncate">
              {guild.name ?? `Guild ${guild.id}`}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-discord-500">
              <span>
                Status:{" "}
                {config ? (isEnabled ? "Active" : "Disabled") : "Not configured"}
              </span>
              {eventSummary ? <span>XP: {eventSummary}</span> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Toggle
              checked={isEnabled}
              onChange={() => handleToggleEnabled(guild.id, isEnabled)}
            >
              Leaderboard
            </Toggle>
            <button
              type="button"
              onClick={() => openEdit(guild)}
              className="rounded-lg border border-white/10 bg-discord-800 px-2.5 py-1.5 text-xs text-discord-200 hover:text-discord-200"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Navbar title="Leaderboard Configuration" />

      <main className="flex-1 overflow-y-auto space-y-4 px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i}>
                <SkeletonLine className="h-4 w-1/3" />
                <SkeletonLine className="mt-2 h-3 w-2/3" />
                <SkeletonLine className="mt-4 h-3 w-full" />
                <SkeletonLine className="mt-2 h-3 w-1/2" />
              </SkeletonCard>
            ))}
          </div>
        ) : (
          <ConfigView
            items={data.guilds}
            sortDefs={leaderboardSortDefs}
            getSearchText={getSearchText}
            renderItem={renderCard}
            emptyMessage="No servers available."
          />
        )}
      </main>

      <Modal isOpen={showModal && editingGuild !== null} onClose={closeModal} maxWidth="max-w-2xl">
        <h2 className="font-display text-lg text-discord-200">
          {editingGuild?.name ?? `Guild ${editingGuild?.id}`}
        </h2>

        <FormError message={formError} />

        <div className="mt-4 space-y-4">
          <div>
            <h3 className="font-display text-base text-discord-200">
              XP Settings
              <Tooltip>Award XP to users for GitHub activities. Toggle events on/off and set how much XP each is worth. Disabled events will not award XP.</Tooltip>
            </h3>
            <div className="mt-4 space-y-2 max-h-[200px] overflow-y-auto">
              {XP_EVENTS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 rounded-xl border border-white/5 bg-discord-900 px-4 py-2.5">
                  <CheckButton
                    checked={modalEnabledEvents.has(key)}
                    onChange={() => toggleModalEvent(key)}
                    className="w-[140px] text-left"
                  >
                    {label}
                  </CheckButton>
                  <NumberStepper
                    value={modalXpSettings[key] ?? 0}
                    onChange={(v) => setModalXpSettings((prev) => ({ ...prev, [key]: v }))}
                    step={5}
                    disabled={!modalEnabledEvents.has(key)}
                  />
                  <span className="text-xs text-discord-500">XP</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base text-discord-200">
                Role Milestones
                <Tooltip>Automatically assign Discord roles to users when they reach specific XP levels.</Tooltip>
              </h3>
              <button
                type="button"
                onClick={openAddMilestone}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-discord-400 hover:text-discord-200"
              >
                + Add Milestone
              </button>
            </div>
            <div className="mt-4 max-h-[10rem] space-y-2 overflow-y-auto">
              {modalMilestones.map((m, i) => (
                <div key={i} className="grid grid-cols-[3.5rem_minmax(0,10rem)_auto_auto_auto_auto] items-center gap-x-3 rounded-xl border border-white/5 bg-discord-900 px-4 py-3">
                  <span className="text-discord-blurple font-semibold text-sm">Lvl {m.level}</span>
                  <span className="truncate text-sm text-discord-200">{m.role_name}</span>
                  <span className="inline-block w-3.5 h-3.5 rounded" style={{ backgroundColor: m.color }} />
                  <span className="text-xs text-discord-500 whitespace-nowrap">
                    {[m.hoist ? "Hoisted" : "", m.remove_previous ? "Replaces lower" : ""].filter(Boolean).join(" · ") || "\u00A0"}
                  </span>
                  <button type="button" onClick={() => openEditMilestone(i)} className="text-xs text-discord-500 hover:text-discord-200">Edit</button>
                  <button type="button" onClick={() => removeModalMilestone(i)} className="text-xs text-discord-500 hover:text-red-400">Remove</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs text-discord-400 hover:text-discord-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showMilestoneModal} onClose={closeMilestoneModal} maxWidth="max-w-sm">
        <h2 className="font-display text-lg text-discord-200">
          {editingMilestoneIdx !== null ? "Edit Milestone" : "New Milestone"}
        </h2>

        <div className="mt-4 space-y-4">
          <label className="text-xs text-discord-500">
            Level
            <Tooltip>The XP level a user must reach to earn this role.</Tooltip>
            <div className="mt-1">
              <NumberStepper
                value={milestoneForm.level}
                onChange={(v) => setMilestoneForm((prev) => ({ ...prev, level: v }))}
                step={1}
                min={1}
              />
            </div>
          </label>

          <label className="text-xs text-discord-500">
            Role Name
            <Tooltip>The name of the Discord role created and assigned at this milestone.</Tooltip>
            <input
              type="text"
              value={milestoneForm.role_name}
              onChange={(e) => setMilestoneForm((prev) => ({ ...prev, role_name: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-sm text-discord-200 outline-none focus:border-discord-blurple"
            />
          </label>

          <label className="inline-flex items-center text-xs text-discord-500">
            Color
            <Tooltip>The color of the Discord role, which controls the user's name color in the server.</Tooltip>
            <input
              type="color"
              value={milestoneForm.color}
              onChange={(e) => setMilestoneForm((prev) => ({ ...prev, color: e.target.value }))}
              className="ml-2 h-6 w-8 cursor-pointer rounded border border-white/10 bg-transparent p-0.5"
            />
          </label>

          <div>
            <p className="mb-1.5 text-xs text-discord-500">
              Options
              <Tooltip>Hoist - Display this role separately in the member list sidebar, making it stand out. Remove Previous - Remove the previous role when a user reaches this level.</Tooltip>
            </p>
            <div className="grid grid-cols-2 gap-2">
            <CheckButton
              checked={milestoneForm.hoist}
              onChange={() => setMilestoneForm((prev) => ({ ...prev, hoist: !prev.hoist }))}
              size="md"
              className="w-full justify-center"
            >
              Hoist
            </CheckButton>
            <CheckButton
              checked={milestoneForm.remove_previous}
              onChange={() => setMilestoneForm((prev) => ({ ...prev, remove_previous: !prev.remove_previous }))}
              size="md"
              className="w-full justify-center"
            >
              Remove previous
            </CheckButton>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={closeMilestoneModal}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs text-discord-400 hover:text-discord-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveMilestone}
            disabled={!milestoneForm.role_name.trim()}
            className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {editingMilestoneIdx !== null ? "Save Changes" : "Add Milestone"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default LeaderboardConfigPage;
