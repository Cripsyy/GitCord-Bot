import { useMemo, useState } from "react";
import type { Channel, Guild, Overview, Repository, WebhookConfig } from "./types";

type DashboardState = {
  overview: Overview | null;
  guilds: Guild[];
  repositories: Repository[];
  webhooks: WebhookConfig[];
  channels: Channel[];
};

const emptyState: DashboardState = {
  overview: null,
  guilds: [],
  repositories: [],
  webhooks: [],
  channels: [],
};

const initialForm = {
  guild_id: "",
  secret_slug: "",
  webhook_secret: "",
  repository_full_name: "",
  channel_id: "",
  llm_model: "",
  ai_max_diff_chars: "12000",
  ai_summary_enabled: "true",
};

function App() {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState("Awaiting API key");
  const [formStatus, setFormStatus] = useState("Ready");
  const [data, setData] = useState<DashboardState>(emptyState);
  const [form, setForm] = useState(initialForm);
  const [deleteId, setDeleteId] = useState("");

  const headers = useMemo(() => {
    return apiKey ? { "X-Dashboard-Key": apiKey } : {};
  }, [apiKey]);

  async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(path, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    return response.json() as Promise<T>;
  }

  async function loadDashboard() {
    if (!apiKey) {
      setStatus("Dashboard API key required");
      return;
    }
    setStatus("Loading data...");
    try {
      const [overview, guilds, repositories, webhooks, channels] = await Promise.all([
        fetchJson<Overview>("/api/dashboard/overview"),
        fetchJson<Guild[]>("/api/dashboard/guilds"),
        fetchJson<Repository[]>("/api/dashboard/repositories"),
        fetchJson<WebhookConfig[]>("/api/dashboard/webhooks"),
        fetchJson<Channel[]>("/api/dashboard/channels"),
      ]);
      setData({ overview, guilds, repositories, webhooks, channels });
      setStatus("Live");
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormStatus("Saving...");
    try {
      const payload = {
        guild_id: Number(form.guild_id),
        secret_slug: form.secret_slug.trim(),
        webhook_secret: form.webhook_secret.trim(),
        repository_full_name: form.repository_full_name.trim(),
        channel_id: Number(form.channel_id),
        llm_model: form.llm_model.trim() || null,
        ai_max_diff_chars: Number(form.ai_max_diff_chars || 12000),
        ai_summary_enabled: form.ai_summary_enabled === "true",
      };
      const response = await fetch("/api/dashboard/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      setFormStatus("Saved");
      setForm(initialForm);
      await loadDashboard();
    } catch (error) {
      setFormStatus(`Error: ${(error as Error).message}`);
    }
  }

  async function handleDelete() {
    if (!deleteId.trim()) {
      setFormStatus("Enter a webhook ID to delete");
      return;
    }
    setFormStatus("Deleting...");
    try {
      const response = await fetch(`/api/dashboard/webhooks/${deleteId.trim()}`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok && response.status !== 204) {
        const text = await response.text();
        throw new Error(text || response.statusText);
      }
      setFormStatus("Deleted");
      setDeleteId("");
      await loadDashboard();
    } catch (error) {
      setFormStatus(`Error: ${(error as Error).message}`);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="px-[6vw] pt-10 pb-4">
        <div className="space-y-3">
          <p className="text-moss-500 uppercase tracking-[0.4em] text-xs">
            GitCord DevOps Bot
          </p>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl leading-tight">
            GitCord Command Center
          </h1>
          <p className="text-sand-200 max-w-2xl text-base md:text-lg">
            Monitor guild activity, map repositories to Discord channels, and manage
            webhook secrets for GitHub automation.
          </p>
        </div>
      </header>

      <main className="px-[6vw] pb-20 space-y-7">
        <section className="rounded-3xl border border-white/10 bg-white/5 shadow-glow backdrop-blur px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl">Dashboard Access</h2>
              <p className="text-sand-200 text-sm">{status}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                type="password"
                placeholder="Paste dashboard API key"
                className="min-w-[220px] rounded-full border border-white/15 bg-black/30 px-4 py-2 text-sm"
              />
              <button
                type="button"
                onClick={loadDashboard}
                className="rounded-full bg-moss-500 px-5 py-2 text-sm font-semibold text-ink-900 shadow-lg shadow-moss-500/30"
              >
                Load Dashboard
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 shadow-glow px-6 py-6">
          <h2 className="font-display text-2xl mb-4">Overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Guilds", value: data.overview?.guilds ?? 0 },
              { label: "Repositories", value: data.overview?.repositories ?? 0 },
              { label: "Channels", value: data.overview?.channels ?? 0 },
              { label: "Webhooks", value: data.overview?.webhook_configs ?? 0 },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-white/5 bg-white/10 px-4 py-4"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-sand-200">
                  {card.label}
                </p>
                <p className="font-display text-3xl mt-2">{card.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-glow px-6 py-6">
            <h2 className="font-display text-2xl mb-4">Guilds</h2>
            <div className="space-y-3">
              {data.guilds.length ? (
                data.guilds.slice(0, 12).map((guild) => (
                  <div
                    key={guild.id}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <p className="text-sm font-semibold">
                      {guild.name ?? "Unnamed guild"}
                    </p>
                    <p className="text-xs text-sand-200">ID: {guild.id}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-sand-200">No data yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-glow px-6 py-6">
            <h2 className="font-display text-2xl mb-4">Repositories</h2>
            <div className="space-y-3">
              {data.repositories.length ? (
                data.repositories.slice(0, 12).map((repo) => (
                  <div
                    key={repo.id}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <p className="text-sm font-semibold">{repo.full_name}</p>
                    <p className="text-xs text-sand-200">Guild: {repo.guild_id}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-sand-200">No data yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-glow px-6 py-6">
            <h2 className="font-display text-2xl mb-4">Webhook Configs</h2>
            <div className="space-y-3">
              {data.webhooks.length ? (
                data.webhooks.slice(0, 12).map((webhook) => (
                  <div
                    key={webhook.id}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <p className="text-sm font-semibold">
                      {webhook.repository_full_name} → {webhook.channel_id}
                    </p>
                    <p className="text-xs text-sand-200">
                      Slug: {webhook.secret_slug} | ID: {webhook.id}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-sand-200">No data yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 shadow-glow px-6 py-6">
            <h2 className="font-display text-2xl mb-4">Channels</h2>
            <div className="space-y-3">
              {data.channels.length ? (
                data.channels.slice(0, 12).map((channel) => (
                  <div
                    key={channel.id}
                    className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <p className="text-sm font-semibold">
                      {channel.name ?? "Unnamed channel"}
                    </p>
                    <p className="text-xs text-sand-200">
                      ID: {channel.channel_id}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-sand-200">No data yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 shadow-glow px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-2xl">Create / Update Webhook</h2>
            <p className="text-sm text-sand-200">{formStatus}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { key: "guild_id", label: "Guild ID", type: "number" },
                { key: "secret_slug", label: "Secret Slug", type: "text" },
                { key: "webhook_secret", label: "Webhook Secret", type: "text" },
                { key: "repository_full_name", label: "Repository Full Name", type: "text" },
                { key: "channel_id", label: "Channel ID", type: "number" },
                { key: "llm_model", label: "LLM Model", type: "text" },
                { key: "ai_max_diff_chars", label: "AI Diff Limit", type: "number" },
              ].map((field) => (
                <label key={field.key} className="text-xs text-sand-200">
                  {field.label}
                  <input
                    type={field.type}
                    value={form[field.key as keyof typeof form]}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                    required={
                      ["guild_id", "secret_slug", "webhook_secret", "repository_full_name", "channel_id"].includes(
                        field.key
                      )
                    }
                  />
                </label>
              ))}
              <label className="text-xs text-sand-200">
                AI Summary Enabled
                <select
                  value={form.ai_summary_enabled}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      ai_summary_enabled: event.target.value,
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-full bg-moss-500 px-5 py-2 text-sm font-semibold text-ink-900"
              >
                Save Webhook
              </button>
              <button
                type="button"
                onClick={loadDashboard}
                className="rounded-full border border-white/20 px-5 py-2 text-sm"
              >
                Refresh Data
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 shadow-glow px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-2xl">Danger Zone</h2>
            <p className="text-sm text-amber-200">Deletes are permanent</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={deleteId}
              onChange={(event) => setDeleteId(event.target.value)}
              type="number"
              placeholder="Webhook ID"
              className="min-w-[160px] rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-full border border-white/20 px-5 py-2 text-sm"
            >
              Delete Webhook
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
