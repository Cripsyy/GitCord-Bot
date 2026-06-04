import { useEffect, useState } from "react";
import type { Channel, Guild, SummaryConfig } from "../types";
import Navbar from "../components/Navbar";
import SearchDropdown from "../components/SearchDropdown";
import ConfigView from "../components/ConfigView";
import type { SortDef } from "../components/ConfigView";
import Toggle from "../components/Toggle";
import CheckButton from "../components/CheckButton";
import Modal from "../components/Modal";
import FormError from "../components/FormError";
import { SkeletonCard, SkeletonLine } from "../components/Skeleton";
import { showError } from "../lib/toast";
import { useConfirm } from "../components/ConfirmDialog";
import { api } from "../lib/api";

type PageData = {
  guilds: Guild[];
  channels: Channel[];
  configs: SummaryConfig[];
};

type FormState = {
  guild_id: string;
  channel_id: string;
  send_time: string;
  include_prs: boolean;
  include_issues: boolean;
  include_standups: boolean;
  enabled: boolean;
};

const emptyForm: FormState = {
  guild_id: "",
  channel_id: "",
  send_time: "09:00",
  include_prs: true,
  include_issues: true,
  include_standups: true,
  enabled: true,
};

function AutomatedSummaries() {
  const [data, setData] = useState<PageData>({ guilds: [], channels: [], configs: [] });
  const [loading, setLoading] = useState(true);

  const confirm = useConfirm();

  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SummaryConfig | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [guilds, channels, configs] = await Promise.all([
        api.get<Guild[]>("/api/dashboard/guilds", { showError: false }),
        api.get<Channel[]>("/api/dashboard/channels", { showError: false }),
        api.get<SummaryConfig[]>("/api/dashboard/summary-configs", { showError: false }),
      ]);
      setData({ guilds, channels, configs });
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setEditingConfig(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(config: SummaryConfig) {
    setEditingConfig(config);
    setForm({
      guild_id: config.guild_id,
      channel_id: config.channel_id,
      send_time: config.send_time,
      include_prs: config.include_prs,
      include_issues: config.include_issues,
      include_standups: config.include_standups,
      enabled: config.enabled,
    });
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingConfig(null);
    setFormError("");
  }

  function updateForm(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setFormError("");
    try {
      const isEditing = editingConfig !== null;
      const url = isEditing
        ? `/api/dashboard/summary-configs/${editingConfig.id}`
        : "/api/dashboard/summary-configs";

      const body: Record<string, unknown> = {
        channel_id: form.channel_id,
        send_time: form.send_time,
        include_prs: form.include_prs,
        include_issues: form.include_issues,
        include_standups: form.include_standups,
        enabled: form.enabled,
      };

      if (!isEditing) {
        body.guild_id = form.guild_id;
      }

      if (isEditing) {
        await api.put(url, body, {
          showSuccess: true,
          successMessage: "Summary schedule saved",
          showError: false,
          onError: (err) => setFormError(err.message),
        });
      } else {
        await api.post(url, body, {
          showSuccess: true,
          successMessage: "Summary schedule saved",
          showError: false,
          onError: (err) => setFormError(err.message),
        });
      }
      closeModal();
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(configId: string) {
    if (!(await confirm("Delete this summary configuration?", { danger: true }))) return;
    await api.delete(`/api/dashboard/summary-configs/${configId}`, {
      showSuccess: true,
      successMessage: "Summary configuration deleted",
    });
    await loadData();
  }

  const guildOptions = data.guilds.map((g) => ({
    value: g.id,
    label: g.name ?? `Guild ${g.id}`,
  }));

  const channelOptions = data.channels
    .filter((ch) => !form.guild_id || String(ch.guild_id) === form.guild_id)
    .map((ch) => ({
      value: ch.channel_id,
      label: `${ch.name ?? "Unnamed"} (${ch.channel_id})`,
    }));

  const summarySortDefs: SortDef<SummaryConfig>[] = [
    {
      value: "guild",
      label: "Server",
      compare: (a, b) => {
        const aName = data.guilds.find((g) => String(g.id) === a.guild_id)?.name ?? a.guild_id;
        const bName = data.guilds.find((g) => String(g.id) === b.guild_id)?.name ?? b.guild_id;
        return aName.localeCompare(bName);
      },
    },
    {
      value: "channel",
      label: "Channel",
      compare: (a, b) => {
        const aName = data.channels.find((c) => String(c.channel_id) === a.channel_id)?.name ?? a.channel_id;
        const bName = data.channels.find((c) => String(c.channel_id) === b.channel_id)?.name ?? b.channel_id;
        return aName.localeCompare(bName);
      },
    },
    {
      value: "time",
      label: "Time",
      compare: (a, b) => a.send_time.localeCompare(b.send_time),
    },
    {
      value: "status",
      label: "Status",
      compare: (a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1),
    },
  ];

  function getSummarySearchText(config: SummaryConfig): string {
    const guildName = data.guilds.find((g) => String(g.id) === config.guild_id)?.name ?? "";
    const channelName = data.channels.find((c) => String(c.channel_id) === config.channel_id)?.name ?? "";
    const includedItems = [
      config.include_prs ? "PRs" : null,
      config.include_issues ? "Issues" : null,
      config.include_standups ? "Standups" : null,
    ].filter(Boolean).join(" ");
    return `${guildName} ${channelName} ${includedItems} ${config.send_time} ${config.enabled ? "active" : "disabled"}`;
  }

  function renderSummaryCard(config: SummaryConfig) {
    const guildName = data.guilds.find((g) => String(g.id) === config.guild_id)?.name;
    const channelName = data.channels.find(
      (c) => String(c.channel_id) === config.channel_id
    )?.name;
    const includedItems = [
      config.include_prs ? "PRs" : null,
      config.include_issues ? "Issues" : null,
      config.include_standups ? "Standups" : null,
    ].filter(Boolean).join(", ");
    return (
      <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-4 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-base text-discord-200">
              {guildName ?? `Guild ${config.guild_id}`}
            </p>
            <p className="mt-0.5 text-xs text-discord-400">
              Channel: {channelName ?? `Channel ${config.channel_id}`}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-discord-500">
              <span>Time: {config.send_time} UTC</span>
              <span>Includes: {includedItems}</span>
              <span>Status: {config.enabled ? "Active" : "Disabled"}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => openEdit(config)}
              className="rounded-lg border border-white/10 bg-discord-800 px-2.5 py-1.5 text-xs text-discord-200 hover:text-discord-200"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleDelete(config.id)}
              className="rounded-lg border border-white/10 bg-discord-800 px-2.5 py-1.5 text-xs text-discord-200 hover:text-red-400"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Navbar title="Automated Summaries" />

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
          <>
            <ConfigView
              items={data.configs}
              sortDefs={summarySortDefs}
              getSearchText={getSummarySearchText}
              renderItem={renderSummaryCard}
              emptyMessage='No summary schedules yet. Click "New Summary Schedule" to create one.'
              toolbarExtra={
                <button
                  type="button"
                  onClick={openCreate}
                  className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white"
                >
                  + New Summary
                </button>
              }
            />
          </>
        )}
      </main>

      <Modal isOpen={showModal} onClose={closeModal} maxWidth="max-w-lg">
        <h2 className="font-display text-lg text-discord-200">
          {editingConfig ? "Edit Summary Schedule" : "New Summary Schedule"}
        </h2>

        <FormError message={formError} />

        <div className="mt-4 space-y-4">
          {editingConfig ? (
            <p className="text-xs text-discord-500">
              Server: {data.guilds.find((g) => String(g.id) === editingConfig.guild_id)?.name ?? editingConfig.guild_id}
            </p>
          ) : (
            <SearchDropdown
              label="Server"
              items={guildOptions}
              selected={form.guild_id}
              onSelect={(value) => {
                updateForm("guild_id", value);
                if (value && form.channel_id) {
                  const channelStillValid = data.channels.some(
                    (ch) => String(ch.channel_id) === form.channel_id && String(ch.guild_id) === value
                  );
                  if (!channelStillValid) updateForm("channel_id", "");
                }
              }}
              placeholder="Select a server"
            />
          )}

          <SearchDropdown
            label="Channel"
            items={channelOptions}
            selected={form.channel_id}
            onSelect={(value) => updateForm("channel_id", value)}
            placeholder="Select a channel"
          />

          <label className="text-xs text-discord-500">
            Send Time (UTC)
            <input
              type="time"
              value={form.send_time}
              onChange={(e) => updateForm("send_time", e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-sm text-discord-200 outline-none focus:border-discord-blurple"
            />
          </label>

          <div>
            <p className="mb-1.5 text-xs text-discord-500">Include in Briefing</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "include_prs", label: "Open PRs Needing Review" },
                { key: "include_issues", label: "Unassigned Issues" },
                { key: "include_standups", label: "Yesterday's Standups" },
              ].map((item) => (
                <CheckButton
                  key={item.key}
                  checked={form[item.key as keyof FormState] as boolean}
                  onChange={() => updateForm(item.key as keyof FormState, !form[item.key as keyof FormState])}
                >
                  {item.label}
                </CheckButton>
              ))}
            </div>
          </div>

          <Toggle
            checked={form.enabled}
            onChange={(checked) => updateForm("enabled", checked)}
          >
            Enabled
          </Toggle>
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
            disabled={saving || !form.guild_id || !form.channel_id || !form.send_time}
            className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : editingConfig ? "Save Changes" : "Create"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default AutomatedSummaries;
