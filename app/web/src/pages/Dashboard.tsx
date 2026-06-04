import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Channel, Guild, Overview, Repository, WebhookConfig, SummaryConfig, SessionInfo } from "../types";
import Navbar from "../components/Navbar";
import DashboardSection from "../components/DashboardSection";
import { api } from "../lib/api";
import { showError } from "../lib/toast";

type DashboardState = {
  overview: Overview | null;
  guilds: Guild[];
  repositories: Repository[];
  webhooks: WebhookConfig[];
  channels: Channel[];
  summaryConfigs: SummaryConfig[];
};

const emptyState: DashboardState = {
  overview: null,
  guilds: [],
  repositories: [],
  webhooks: [],
  channels: [],
  summaryConfigs: [],
};

function Dashboard() {
  const [status, setStatus] = useState("Loading...");
  const [data, setData] = useState<DashboardState>(emptyState);
  const [session, setSession] = useState<SessionInfo | null>(null);

  async function loadDashboard() {
    setStatus("Loading data...");
    try {
      const [overview, guilds, repositories, webhooks, channels, summaryConfigs, sessionInfo] = await Promise.all([
        api.get<Overview>("/api/dashboard/overview", { showError: false }),
        api.get<Guild[]>("/api/dashboard/guilds", { showError: false }),
        api.get<Repository[]>("/api/dashboard/repositories", { showError: false }),
        api.get<WebhookConfig[]>("/api/dashboard/webhooks", { showError: false }),
        api.get<Channel[]>("/api/dashboard/channels", { showError: false }),
        api.get<SummaryConfig[]>("/api/dashboard/summary-configs", { showError: false }),
        api.get<SessionInfo>("/api/dashboard/session", { showError: false }),
      ]);
      setData({ overview, guilds, repositories, webhooks, channels, summaryConfigs });
      setSession(sessionInfo);
      setStatus("Live");
    } catch (error) {
      showError((error as Error).message);
      setStatus("Error");
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <Navbar title="Server Dashboard" />

      <main className="flex-1 overflow-y-auto space-y-6 px-6 py-6">
        {session?.discord_expired ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3">
            <p className="text-sm text-amber-200">
              Your Discord OAuth token has expired.{" "}
              <a href="/api/oauth/discord/login" className="font-semibold underline">
                Reconnect Discord
              </a>{" "}
              to restore full functionality.
            </p>
          </div>
        ) : null}
        {session?.github_expired ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3">
            <p className="text-sm text-amber-200">
              Your GitHub OAuth token has expired.{" "}
              <a href="/api/oauth/github/login" className="font-semibold underline">
                Reconnect GitHub
              </a>{" "}
              to restore full functionality.
            </p>
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-4 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg text-discord-200">Dashboard Access</h2>
              <p className="text-sm text-discord-500">{status}</p>
            </div>
            <button
              type="button"
              onClick={loadDashboard}
              className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white"
            >
              Load Dashboard
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Guilds", value: data.overview?.guilds ?? 0 },
            { label: "Repositories", value: data.overview?.repositories ?? 0 },
            { label: "Channels", value: data.overview?.channels ?? 0 },
            { label: "Connections", value: data.overview?.connections ?? 0 },
            { label: "Summaries", value: data.overview?.summary_configs ?? data.summaryConfigs.length },
            { label: "Leaderboard", value: data.overview?.leaderboard_entries ?? 0 },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-white/5 bg-discord-850 px-4 py-4"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-discord-500">
                {card.label}
              </p>
              <p className="mt-3 font-display text-2xl text-discord-200">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <DashboardSection title="Guilds">
            {data.guilds.length ? (
              data.guilds.map((guild) => (
                <div
                  key={guild.id}
                  className="rounded-xl border border-white/5 bg-discord-900 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-discord-200">
                    {guild.name ?? "Unnamed guild"}
                  </p>
                  <p className="text-xs text-discord-500">ID: {guild.id}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-discord-500">No data yet.</p>
            )}
          </DashboardSection>

          <DashboardSection title="Repositories">
            {data.repositories.length ? (
              data.repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="rounded-xl border border-white/5 bg-discord-900 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-discord-200">{repo.full_name}</p>
                  <p className="text-xs text-discord-500">
                    {repo.private ? "Private" : "Public"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-discord-500">
                Connect Discord + GitHub to list repositories.
              </p>
            )}
          </DashboardSection>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <DashboardSection
            title="Repository Connections"
            action={
              <Link
                to="/configurations/connections"
                className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white"
              >
                Manage Connections
              </Link>
            }
          >
            {data.webhooks.length ? (
              data.webhooks.map((webhook) => {
                const subs = webhook.subscriptions ?? [];
                return (
                  <div
                    key={webhook.id}
                    className="rounded-xl border border-white/5 bg-discord-900 px-4 py-3"
                  >
                    <p className="text-sm font-semibold truncate text-discord-200">
                      {webhook.repository_full_name}
                    </p>
                    {subs.length > 0 ? (
                      subs.map((sub) => {
                        const guildName = data.guilds.find(
                          (g) => String(g.id) === sub.guild_id
                        )?.name;
                        const channelName = data.channels.find(
                          (c) => String(c.channel_id) === sub.channel_id
                        )?.name;
                        return (
                          <p key={sub.id} className="text-xs text-discord-400">
                            {guildName ?? `Guild ${sub.guild_id}`} → {channelName ?? `Channel ${sub.channel_id}`}
                          </p>
                        );
                      })
                    ) : (
                      <p className="text-xs text-discord-500">No subscriptions</p>
                    )}
                    <p className="text-xs text-discord-500">
                      Slug: {webhook.secret_slug}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-discord-500">
                No connections yet.{" "}
                <Link to="/configurations/connections" className="text-discord-blurple underline">
                  Create one
                </Link>
              </p>
            )}
          </DashboardSection>

          <DashboardSection
            title="Summaries"
            action={
              <Link
                to="/configurations/summaries"
                className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white"
              >
                Manage Summaries
              </Link>
            }
          >
            {data.summaryConfigs.length ? (
              data.summaryConfigs.map((config) => {
                const guildName = data.guilds.find(
                  (g) => String(g.id) === config.guild_id
                )?.name;
                const channelName = data.channels.find(
                  (c) => String(c.channel_id) === config.channel_id
                )?.name;
                const includedItems = [
                  config.include_prs ? "PRs" : null,
                  config.include_issues ? "Issues" : null,
                  config.include_standups ? "Standups" : null,
                ].filter(Boolean).join(", ");
                return (
                  <div
                    key={config.id}
                    className="rounded-xl border border-white/5 bg-discord-900 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-discord-200">
                      {guildName ?? `Guild ${config.guild_id}`}
                    </p>
                    <p className="text-xs text-discord-400">
                      {channelName ?? `Channel ${config.channel_id}`} — {config.send_time} UTC
                    </p>
                    <p className="text-xs text-discord-500">
                      {includedItems} · {config.enabled ? "Active" : "Disabled"}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-discord-500">
                No summary schedules yet.{" "}
                <Link to="/configurations/summaries" className="text-discord-blurple underline">
                  Create one
                </Link>
              </p>
            )}
          </DashboardSection>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <DashboardSection title="Channels">
            {data.channels.length ? (
              data.channels.map((channel) => {
                const guildName = data.guilds.find(
                  (g) => String(g.id) === channel.guild_id
                )?.name;
                return (
                  <div
                    key={channel.id}
                    className="rounded-xl border border-white/5 bg-discord-900 px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-discord-200">
                      {channel.name ?? "Unnamed channel"}
                    </p>
                    <p className="text-xs text-discord-500">
                      {guildName ?? `Guild ${channel.guild_id}`} | ID: {channel.channel_id}
                    </p>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-discord-500">
                No channels available. Connect the bot to a Discord server.
              </p>
            )}
          </DashboardSection>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
