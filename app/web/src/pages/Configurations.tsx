import { useEffect, useMemo, useState } from "react";
import type { Channel, Guild, Repository, WebhookConfig } from "../types";
import Navbar from "../components/Navbar";

type PageData = {
  guilds: Guild[];
  repositories: Repository[];
  webhooks: WebhookConfig[];
  channels: Channel[];
};

type WebhookForm = {
  guild_id: string;
  channel_id: string;
  repository_full_name: string;
  ai_summary_enabled: boolean;
  ai_max_diff_chars: number;
  events: string[];
};

type SearchDropdownProps = {
  label: string;
  items: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  placeholder?: string;
};

function SearchDropdown({ label, items, selected, onSelect, placeholder }: SearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = items.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );
  const selectedLabel = items.find((i) => i.value === selected)?.label;

  return (
    <label className="text-xs text-discord-500">
      {label}
      <div className="relative mt-1">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-sm text-discord-200"
        >
          <span className="truncate">{selectedLabel ?? placeholder ?? "Select..."}</span>
          <span className="ml-2 shrink-0 text-discord-500">▾</span>
        </button>
        {open ? (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-discord-900 p-2">
            <button
              type="button"
              onClick={() => { onSelect(""); setOpen(false); setSearch(""); }}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs text-discord-500 hover:bg-discord-850"
            >
              Clear selection
            </button>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="mt-1 w-full rounded-md border border-white/10 bg-discord-850 px-2 py-1.5 text-xs text-discord-200 outline-none focus:border-discord-blurple"
            />
            <div className="mt-1 max-h-40 overflow-y-auto">
              {filtered.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => { onSelect(item.value); setOpen(false); setSearch(""); }}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-discord-850 ${
                    item.value === selected ? "text-discord-blurple" : "text-discord-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {filtered.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-discord-500">No matches</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </label>
  );
}

const ALL_EVENTS = ["push", "pull_request", "issues"];

const emptyForm: WebhookForm = {
  guild_id: "",
  channel_id: "",
  repository_full_name: "",
  ai_summary_enabled: true,
  ai_max_diff_chars: 12000,
  events: ["push", "pull_request", "issues"],
};

function Configurations() {
  const [data, setData] = useState<PageData>({ guilds: [], repositories: [], webhooks: [], channels: [] });
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);
  const [form, setForm] = useState<WebhookForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [testMessage, setTestMessage] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);

  const headers = useMemo(() => ({}), []);

  async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(path, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    return response.json() as Promise<T>;
  }

  async function loadData() {
    setLoading(true);
    try {
      const [guilds, repositories, webhooks, channels] = await Promise.all([
        fetchJson<Guild[]>("/api/dashboard/guilds"),
        fetchJson<Repository[]>("/api/dashboard/repositories"),
        fetchJson<WebhookConfig[]>("/api/dashboard/webhooks"),
        fetchJson<Channel[]>("/api/dashboard/channels"),
      ]);
      setData({ guilds, repositories, webhooks, channels });
    } catch (error) {
      setStatusMessage(`Error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setEditingWebhook(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(webhook: WebhookConfig) {
    setEditingWebhook(webhook);
    setForm({
      guild_id: webhook.guild_id,
      channel_id: webhook.channel_id,
      repository_full_name: webhook.repository_full_name,
      ai_summary_enabled: webhook.ai_summary_enabled,
      ai_max_diff_chars: webhook.ai_max_diff_chars,
      events: webhook.events?.length ? webhook.events : ["push", "pull_request", "issues"],
    });
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingWebhook(null);
    setFormError("");
  }

  function updateForm(field: keyof WebhookForm, value: string | boolean | number | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleEvent(event: string) {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setFormError("");
    try {
      const isEditing = editingWebhook !== null;
      const url = isEditing
        ? `/api/dashboard/webhooks/${editingWebhook.id}`
        : "/api/dashboard/webhooks";
      const method = isEditing ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        channel_id: form.channel_id,
        repository_full_name: form.repository_full_name,
        ai_summary_enabled: form.ai_summary_enabled,
        ai_max_diff_chars: form.ai_max_diff_chars,
        events: form.events,
      };

      if (!isEditing) {
        body.guild_id = form.guild_id;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      closeModal();
      await loadData();
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(webhookId: string) {
    if (!window.confirm("Delete this webhook configuration?")) return;
    setStatusMessage("Deleting...");
    try {
      const response = await fetch(`/api/dashboard/webhooks/${webhookId}`, { method: "DELETE", headers });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      setStatusMessage("Deleted");
      await loadData();
    } catch (error) {
      setStatusMessage(`Error: ${(error as Error).message}`);
    }
  }

  async function handleSendTest(webhookId: string) {
    if (!testMessage.trim()) return;
    setTestSending(true);
    setTestingId(webhookId);
    try {
      const response = await fetch(`/api/dashboard/webhooks/${webhookId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ message: testMessage }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      setTestMessage("");
    } catch (error) {
      setStatusMessage(`Test error: ${(error as Error).message}`);
    } finally {
      setTestSending(false);
      setTestingId(null);
    }
  }

  const channelOptions = data.channels
    .filter((ch) => !form.guild_id || String(ch.guild_id) === form.guild_id)
    .map((ch) => ({
      value: ch.channel_id,
      label: `${ch.name ?? "Unnamed"} (${ch.channel_id})`,
    }));

  const repoOptions = data.repositories.map((r) => ({
    value: r.full_name,
    label: r.full_name,
  }));

  const guildOptions = data.guilds.map((g) => ({
    value: g.id,
    label: g.name ?? `Guild ${g.id}`,
  }));

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Navbar title="Webhook Configurations" />

      <main className="flex-1 overflow-y-auto space-y-4 px-6 py-6">
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white"
        >
          + New Configuration
        </button>

        {loading ? (
          <p className="text-sm text-discord-500">Loading...</p>
        ) : (
          <>
            {statusMessage ? (
              <p className="text-sm text-discord-400">{statusMessage}</p>
            ) : null}

            {data.webhooks.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-8 text-center">
                <p className="text-sm text-discord-500">
                  No webhook configurations yet. Click "New Configuration" to create one.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.webhooks.map((webhook) => {
                  const guildName = data.guilds.find((g) => String(g.id) === webhook.guild_id)?.name;
                  const channelName = data.channels.find(
                    (c) => String(c.channel_id) === webhook.channel_id
                  )?.name;
                  return (
                    <div
                      key={webhook.id}
                      className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-base text-discord-200 truncate">
                            {webhook.repository_full_name}
                          </p>
                          <p className="mt-0.5 text-xs text-discord-400">
                            {guildName ?? `Guild ${webhook.guild_id}`} → {channelName ?? `Channel ${webhook.channel_id}`}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-discord-500">
                            <span>Slug: {webhook.secret_slug}</span>
                            <span>AI: {webhook.ai_summary_enabled ? "On" : "Off"}</span>
                            <span>Events: {webhook.events?.join(", ") ?? "push, pull_request, issues"}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTestingId(webhook.id);
                              setTestMessage("");
                            }}
                            className="rounded-lg border border-white/10 bg-discord-800 px-2.5 py-1.5 text-xs text-discord-400 hover:text-discord-200"
                          >
                            Test
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(webhook)}
                            className="rounded-lg border border-white/10 bg-discord-800 px-2.5 py-1.5 text-xs text-discord-400 hover:text-discord-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(webhook.id)}
                            className="rounded-lg border border-white/10 bg-discord-800 px-2.5 py-1.5 text-xs text-discord-500 hover:text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {testingId === webhook.id ? (
                        <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
                          <input
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            placeholder="Type a test message..."
                            className="min-w-0 flex-1 rounded-md border border-white/10 bg-discord-900 px-3 py-1.5 text-sm text-discord-200 outline-none focus:border-discord-blurple"
                          />
                          <button
                            type="button"
                            onClick={() => handleSendTest(webhook.id)}
                            disabled={testSending || !testMessage.trim()}
                            className="rounded-md bg-discord-blurple px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {testSending ? "Sending..." : "Send"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTestingId(null)}
                            className="text-xs text-discord-500 hover:text-discord-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/5 bg-discord-850 p-6 shadow-soft">
            <h2 className="font-display text-lg text-discord-200">
              {editingWebhook ? "Edit Webhook Configuration" : "New Webhook Configuration"}
            </h2>

            {formError ? (
              <p className="mt-3 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">{formError}</p>
            ) : null}

            <div className="mt-4 space-y-4">
              {editingWebhook ? (
                <p className="text-xs text-discord-500">
                  Server: {data.guilds.find((g) => String(g.id) === editingWebhook.guild_id)?.name ?? editingWebhook.guild_id}
                  <br />
                  Slug: {editingWebhook.secret_slug}
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

              <SearchDropdown
                label="Repository"
                items={repoOptions}
                selected={form.repository_full_name}
                onSelect={(value) => updateForm("repository_full_name", value)}
                placeholder="Select a repository"
              />

              <div>
                <p className="mb-1.5 text-xs text-discord-500">Events</p>
                <div className="flex flex-wrap gap-3">
                  {ALL_EVENTS.map((event) => (
                    <label key={event} className="flex cursor-pointer items-center gap-1.5 text-xs text-discord-300">
                      <input
                        type="checkbox"
                        checked={form.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-white/10"
                      />
                      {event === "pull_request" ? "Pull Request" : event.charAt(0).toUpperCase() + event.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs text-discord-300">
                <input
                  type="checkbox"
                  checked={form.ai_summary_enabled}
                  onChange={(e) => updateForm("ai_summary_enabled", e.target.checked)}
                  className="rounded border-white/10"
                />
                AI Summary Enabled
              </label>

              <label className="text-xs text-discord-500">
                AI Max Diff Characters
                <input
                  type="number"
                  value={form.ai_max_diff_chars}
                  onChange={(e) => updateForm("ai_max_diff_chars", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-sm text-discord-200 outline-none focus:border-discord-blurple"
                />
              </label>
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
                disabled={saving || !form.guild_id || !form.channel_id || !form.repository_full_name}
                className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : editingWebhook ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Configurations;
