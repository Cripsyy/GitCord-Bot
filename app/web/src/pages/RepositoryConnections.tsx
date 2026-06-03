import { useEffect, useState } from "react";
import type { Channel, Guild, Repository, WebhookConfig, WebhookSubscription } from "../types";
import Navbar from "../components/Navbar";
import SearchDropdown from "../components/SearchDropdown";
import ConfigView from "../components/ConfigView";
import type { SortDef } from "../components/ConfigView";
import Toggle from "../components/Toggle";
import CheckButton from "../components/CheckButton";
import NumberStepper from "../components/NumberStepper";
import Modal from "../components/Modal";
import { SkeletonCard, SkeletonLine } from "../components/Skeleton";
import { fetchJson } from "../lib/api";

type PageData = {
  guilds: Guild[];
  repositories: Repository[];
  connections: WebhookConfig[];
  channels: Channel[];
};

type CreateForm = {
  repository_full_name: string;
  guild_id: string;
  channel_id: string;
};

const emptyCreateForm: CreateForm = {
  repository_full_name: "",
  guild_id: "",
  channel_id: "",
};

const ALL_EVENTS = ["push", "pull_request", "issues"];

type SubForm = {
  guild_id: string;
  channel_id: string;
  ai_summary_enabled: boolean;
  ai_max_diff_chars: number;
  events: string[];
};

const emptySubForm: SubForm = {
  guild_id: "",
  channel_id: "",
  ai_summary_enabled: false,
  ai_max_diff_chars: 12000,
  events: ["push", "pull_request", "issues"],
};

function RepositoryConnections() {
  const [data, setData] = useState<PageData>({ guilds: [], repositories: [], connections: [], channels: [] });
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyCreateForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [subModal, setSubModal] = useState<{ webhookId: string; editingSub?: WebhookSubscription } | null>(null);
  const [subForm, setSubForm] = useState<SubForm>(emptySubForm);
  const [subSaving, setSubSaving] = useState(false);

  const [testTarget, setTestTarget] = useState<{ connectionId: string; subId: string } | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const [testSending, setTestSending] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [guilds, repositories, connections, channels] = await Promise.all([
        fetchJson<Guild[]>("/api/dashboard/guilds"),
        fetchJson<Repository[]>("/api/dashboard/repositories"),
        fetchJson<WebhookConfig[]>("/api/dashboard/webhooks"),
        fetchJson<Channel[]>("/api/dashboard/channels"),
      ]);
      setData({ guilds, repositories, connections, channels });
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
    setForm(emptyCreateForm);
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setFormError("");
  }

  function openSubModal(webhookId: string, editingSub?: WebhookSubscription) {
    if (editingSub) {
      setSubForm({
        guild_id: editingSub.guild_id,
        channel_id: editingSub.channel_id,
        ai_summary_enabled: editingSub.ai_summary_enabled,
        ai_max_diff_chars: editingSub.ai_max_diff_chars,
        events: editingSub.events?.length ? editingSub.events : ["push", "pull_request", "issues"],
      });
    } else {
      setSubForm(emptySubForm);
    }
    setSubModal({ webhookId, editingSub });
  }

  function closeSubModal() {
    setSubModal(null);
  }

  function updateCreateForm(field: keyof CreateForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSubEvent(event: string) {
    setSubForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  }

  async function handleCreate() {
    setSaving(true);
    setFormError("");
    try {
      const body: Record<string, unknown> = {
        repository_full_name: form.repository_full_name,
      };
      if (form.guild_id && form.channel_id) {
        body.guild_id = form.guild_id;
        body.channel_id = form.channel_id;
      }

      const response = await fetch("/api/dashboard/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  async function handleSaveSub() {
    if (!subModal) return;
    setSubSaving(true);
    try {
      const isEditing = subModal.editingSub != null;
      const url = isEditing
        ? `/api/dashboard/webhooks/${subModal.webhookId}/subscriptions/${subModal.editingSub!.id}`
        : `/api/dashboard/webhooks/${subModal.webhookId}/subscriptions`;
      const method = isEditing ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        guild_id: subForm.guild_id,
        channel_id: subForm.channel_id,
        ai_summary_enabled: subForm.ai_summary_enabled,
        ai_max_diff_chars: subForm.ai_max_diff_chars,
        events: subForm.events,
      };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      closeSubModal();
      await loadData();
    } catch (error) {
      setStatusMessage(`Error: ${(error as Error).message}`);
    } finally {
      setSubSaving(false);
    }
  }

  async function handleRemoveSub(subscriptionId: string) {
    if (!window.confirm("Remove this subscription?")) return;
    setStatusMessage("Removing...");
    try {
      const parent = data.connections.find((c) =>
        c.subscriptions.some((s) => s.id === subscriptionId)
      );
      if (!parent) return;
      const response = await fetch(
        `/api/dashboard/webhooks/${parent.id}/subscriptions/${subscriptionId}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      setStatusMessage("");
      await loadData();
    } catch (error) {
      setStatusMessage(`Error: ${(error as Error).message}`);
    }
  }

  async function handleDeleteConnection(connectionId: string) {
    if (!window.confirm("Delete this connection and all its subscriptions?")) return;
    setStatusMessage("Deleting...");
    try {
      const response = await fetch(`/api/dashboard/webhooks/${connectionId}`, { method: "DELETE" });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      setStatusMessage("");
      await loadData();
    } catch (error) {
      setStatusMessage(`Error: ${(error as Error).message}`);
    }
  }

  async function handleSendTest(connectionId: string, subscriptionId: string) {
    if (!testMessage.trim()) return;
    setTestSending(true);
    try {
      const response = await fetch(`/api/dashboard/webhooks/${connectionId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: testMessage, subscription_id: subscriptionId }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      setTestMessage("");
      setTestTarget(null);
    } catch (error) {
      setStatusMessage(`Test error: ${(error as Error).message}`);
    } finally {
      setTestSending(false);
    }
  }

  function guildName(guildId: string): string {
    return data.guilds.find((g) => String(g.id) === guildId)?.name ?? guildId;
  }

  function channelName(channelId: string): string {
    return data.channels.find((c) => String(c.channel_id) === channelId)?.name ?? channelId;
  }

  const subChannelOptions = data.channels
    .filter((ch) => !subForm.guild_id || String(ch.guild_id) === subForm.guild_id)
    .map((ch) => ({
      value: ch.channel_id,
      label: `${ch.name ?? "Unnamed"} (${ch.channel_id})`,
    }));

  const createChannelOptions = data.channels
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

  const sortDefs: SortDef<WebhookConfig>[] = [
    {
      value: "repository",
      label: "Repository",
      compare: (a, b) => a.repository_full_name.localeCompare(b.repository_full_name),
    },
    {
      value: "subscribers",
      label: "Subscribers",
      compare: (a, b) => (b.subscriptions?.length ?? 0) - (a.subscriptions?.length ?? 0),
    },
  ];

  function getSearchText(connection: WebhookConfig): string {
    const subs = connection.subscriptions?.map((s) => `${guildName(s.guild_id)}`).join(" ") ?? "";
    return `${connection.repository_full_name} ${subs}`;
  }

  function renderConnectionCard(connection: WebhookConfig) {
    const subs = connection.subscriptions ?? [];

    return (
      <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-4 shadow-soft flex flex-col min-h-[18.5rem]">
        <div className="shrink-0 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-display text-base text-discord-200 truncate">
              {connection.repository_full_name}
            </p>
            <p className="mt-0.5 text-xs text-discord-500">
              Slug: {connection.secret_slug}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => openSubModal(connection.id)}
              className="rounded-lg border border-white/10 bg-discord-800 px-2.5 py-1.5 text-xs text-discord-200 hover:text-discord-200"
            >
              + Subscribe
            </button>
            <button
              type="button"
              onClick={() => handleDeleteConnection(connection.id)}
              className="rounded-lg border border-white/10 bg-discord-800 px-2.5 py-1.5 text-xs text-discord-200 hover:text-red-400"
            >
              Delete
            </button>
          </div>
        </div>

        {subs.length > 0 ? (
          <>
            <div className="mt-3 border-t border-white/5 pt-3">
              <p className="text-xs font-semibold text-discord-400 uppercase tracking-wider">
                Subscriptions ({subs.length})
              </p>
            </div>
            <div className="mt-2 space-y-2 sub-list-scroll">
              {subs.map((sub: WebhookSubscription) => {
                const isTesting = testTarget?.connectionId === connection.id && testTarget?.subId === sub.id;
                return (
                  <div key={sub.id} className="flex items-center justify-between gap-2 rounded-lg bg-discord-900/50 px-3 py-2 sub-row">
                    {isTesting ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          placeholder="Type a test message..."
                          className="min-w-0 flex-1 rounded-md border border-white/10 bg-discord-900 px-2 py-1 text-sm text-discord-200 outline-none focus:border-discord-blurple"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendTest(connection.id, sub.id)}
                          disabled={testSending || !testMessage.trim()}
                          className="rounded-md bg-discord-blurple px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {testSending ? "..." : "Send"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTestTarget(null)}
                          className="text-xs text-discord-500 hover:text-discord-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1 py-1 text-sm text-discord-300 truncate">
                          <span className="font-medium">{guildName(sub.guild_id)}</span>
                          <span className="text-discord-500"> → </span>
                          <span>{channelName(sub.channel_id)}</span>
                          <span className="ml-2 text-discord-500">
                            {sub.events?.map((e) => e === "pull_request" ? "PR" : e).join(", ") ?? ""}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTestTarget({ connectionId: connection.id, subId: sub.id });
                              setTestMessage("");
                            }}
                            className="rounded-md border border-white/10 bg-discord-800 px-2 py-1 text-xs text-discord-400 hover:text-discord-200"
                          >
                            Test
                          </button>
                          <button
                            type="button"
                            onClick={() => openSubModal(connection.id, sub)}
                            className="rounded-md border border-white/10 bg-discord-800 px-2 py-1 text-xs text-discord-400 hover:text-discord-200"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSub(sub.id)}
                            className="rounded-md border border-white/10 bg-discord-800 px-2 py-1 text-xs text-discord-400 hover:text-red-400"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="mt-3 border-t border-white/5 pt-3 empty-state flex items-start">
            <p className="text-xs text-discord-500 italic">No subscriptions yet. Click "+ Subscribe" to connect a server.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Navbar title="Repository Connections" />

      <main className="flex-1 overflow-y-auto space-y-4 px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i}>
                <SkeletonLine className="h-4 w-2/3" />
                <SkeletonLine className="mt-2 h-3 w-1/4" />
                <SkeletonLine className="mt-4 h-3 w-full" />
                <SkeletonLine className="mt-2 h-3 w-5/6" />
              </SkeletonCard>
            ))}
          </div>
        ) : (
          <>
            {statusMessage ? (
              <p className="text-sm text-discord-400">{statusMessage}</p>
            ) : null}

            <ConfigView
              items={data.connections}
              sortDefs={sortDefs}
              getSearchText={getSearchText}
              renderItem={renderConnectionCard}
              emptyMessage='No repository connections yet. Click "New Connection" to get started.'
              toolbarExtra={
                <button
                  type="button"
                  onClick={openCreate}
                  className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white"
                >
                  + New Connection
                </button>
              }
            />
          </>
        )}
      </main>

      <Modal isOpen={showModal} onClose={closeModal} maxWidth="max-w-md">
        <h2 className="font-display text-lg text-discord-200">New Connection</h2>

        {formError ? (
          <p className="mt-3 rounded-lg bg-red-900/30 px-3 py-2 text-xs text-red-400">{formError}</p>
        ) : null}

        <div className="mt-4 space-y-4">
          <SearchDropdown
            label="Repository"
            items={repoOptions}
            selected={form.repository_full_name}
            onSelect={(value) => updateCreateForm("repository_full_name", value)}
            placeholder="Select a repository"
          />

          <SearchDropdown
            label="Server (optional)"
            items={guildOptions}
            selected={form.guild_id}
            onSelect={(value) => {
              updateCreateForm("guild_id", value);
              if (value && form.channel_id) {
                const channelStillValid = data.channels.some(
                  (ch) => String(ch.channel_id) === form.channel_id && String(ch.guild_id) === value
                );
                if (!channelStillValid) updateCreateForm("channel_id", "");
              }
            }}
            placeholder="Select a server"
          />
          <SearchDropdown
            label="Channel (optional)"
            items={createChannelOptions}
            selected={form.channel_id}
            onSelect={(value) => updateCreateForm("channel_id", value)}
            placeholder="Select a channel"
          />
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
            onClick={handleCreate}
            disabled={saving || !form.repository_full_name}
            className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </Modal>

      <Modal isOpen={subModal !== null} onClose={closeSubModal} maxWidth="max-w-md">
        <h2 className="font-display text-lg text-discord-200">
          {subModal?.editingSub ? "Edit Subscription" : "Add Subscription"}
        </h2>

        <div className="mt-4 space-y-4">
          {subModal?.editingSub ? (
            <p className="text-xs text-discord-500">
              {guildName(subModal.editingSub.guild_id)} → {channelName(subModal.editingSub.channel_id)}
            </p>
          ) : (
            <>
              <SearchDropdown
                label="Server"
                items={guildOptions}
                selected={subForm.guild_id}
                onSelect={(value) => {
                  setSubForm((prev) => ({ ...prev, guild_id: value }));
                  const channelStillValid = data.channels.some(
                    (ch) => String(ch.channel_id) === subForm.channel_id && String(ch.guild_id) === value
                  );
                  if (!channelStillValid) setSubForm((prev) => ({ ...prev, channel_id: "" }));
                }}
                placeholder="Select a server"
              />
              <SearchDropdown
                label="Channel"
                items={subChannelOptions}
                selected={subForm.channel_id}
                onSelect={(value) => setSubForm((prev) => ({ ...prev, channel_id: value }))}
                placeholder="Select a channel"
              />
            </>
          )}

          <div>
            <p className="mb-1.5 text-xs text-discord-500">Events</p>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((event) => (
                <CheckButton
                  key={event}
                  checked={subForm.events.includes(event)}
                  onChange={() => toggleSubEvent(event)}
                >
                  {event === "pull_request" ? "Pull Request" : event.charAt(0).toUpperCase() + event.slice(1)}
                </CheckButton>
              ))}
            </div>
          </div>

          <div>
            <Toggle
              checked={subForm.ai_summary_enabled}
              onChange={(checked) => setSubForm((prev) => ({ ...prev, ai_summary_enabled: checked }))}
            >
              AI Summary Enabled
            </Toggle>

            <div className={subForm.ai_summary_enabled ? "" : "invisible"}>
              <div className="mt-3">
                <p className="mb-1.5 text-xs text-discord-500">AI Max Diff Characters</p>
                <NumberStepper
                  value={subForm.ai_max_diff_chars}
                  onChange={(v) => setSubForm((prev) => ({ ...prev, ai_max_diff_chars: v }))}
                  step={100}
                  disabled={!subForm.ai_summary_enabled}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={closeSubModal}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs text-discord-400 hover:text-discord-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveSub}
            disabled={subSaving || !subForm.guild_id || !subForm.channel_id}
            className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {subSaving ? "Saving..." : subModal?.editingSub ? "Save Changes" : "Add"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default RepositoryConnections;
