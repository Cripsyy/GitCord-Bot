import { useEffect, useMemo, useState } from "react";
import type { Channel, Guild, Overview, Repository, WebhookConfig } from "./types";

type DashboardState = {
  overview: Overview | null;
  guilds: Guild[];
  repositories: Repository[];
  webhooks: WebhookConfig[];
  channels: Channel[];
};

type Profile = {
  discord: {
    id: string;
    username: string;
    avatar_url: string;
  } | null;
};

const emptyState: DashboardState = {
  overview: null,
  guilds: [],
  repositories: [],
  webhooks: [],
  channels: [],
};

function App() {
  const [status, setStatus] = useState("Checking OAuth session...");
  const [data, setData] = useState<DashboardState>(emptyState);
  const [disconnecting, setDisconnecting] = useState(false);
  const [profile, setProfile] = useState<Profile>({ discord: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessionInfo, setSessionInfo] = useState({ discord_connected: false, github_connected: false });
  const [selectedGuild, setSelectedGuild] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [repoStatus, setRepoStatus] = useState("Ready");
  const [guildSearch, setGuildSearch] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [repoSearch, setRepoSearch] = useState("");
  const [guildMenuOpen, setGuildMenuOpen] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);

  const headers = useMemo(() => {
    return {};
  }, []);

  async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(path, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    return response.json() as Promise<T>;
  }

  async function loadDashboard() {
    setStatus("Loading data...");
    try {
      const session = await fetchJson<{ discord_connected: boolean; github_connected: boolean }>(
        "/api/dashboard/session"
      );
      setSessionInfo(session);
      if (!session.discord_connected || !session.github_connected) {
        const profileData = await fetchJson<Profile>("/api/dashboard/profile");
        setProfile(profileData);
        setData(emptyState);
        setStatus("Connect Discord and GitHub to continue");
        return;
      }
      const [profileData, overview, guilds, repositories, webhooks, channels] = await Promise.all([
        fetchJson<Profile>("/api/dashboard/profile"),
        fetchJson<Overview>("/api/dashboard/overview"),
        fetchJson<Guild[]>("/api/dashboard/guilds"),
        fetchJson<Repository[]>("/api/dashboard/repositories"),
        fetchJson<WebhookConfig[]>("/api/dashboard/webhooks"),
        fetchJson<Channel[]>("/api/dashboard/channels"),
      ]);
      setProfile(profileData);
      setData({ overview, guilds, repositories, webhooks, channels });
      setStatus("Live");
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/oauth/reset", { method: "POST", headers });
      setStatus("Disconnected");
      setData(emptyState);
      setProfile({ discord: null });
      setSessionInfo({ discord_connected: false, github_connected: false });
      setSelectedGuild("");
      setSelectedChannel("");
      setSelectedRepos([]);
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSaveRepos() {
    setRepoStatus("Saving...");
    try {
      const payload = {
        guild_id: selectedGuild,
        channel_id: selectedChannel,
        repositories: selectedRepos,
      };
      const response = await fetch("/api/dashboard/subscriptions", {
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
      setRepoStatus("Saved");
      await loadDashboard();
    } catch (error) {
      setRepoStatus(`Error: ${(error as Error).message}`);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="min-h-screen bg-discord-900 text-discord-200">
      <div className="flex min-h-screen">
        <aside className="hidden w-[260px] flex-col border-r border-white/5 bg-discord-950 px-5 py-6 lg:flex">
          <div className="flex items-center gap-3 rounded-2xl bg-discord-850 px-3 py-3">
            <div className="h-10 w-10 rounded-xl bg-discord-blurple/20 text-discord-blurple flex items-center justify-center font-display text-lg">
              GC
            </div>
            <div>
              <p className="font-display text-lg leading-none text-discord-200">GitCord</p>
              <p className="text-xs text-discord-500">Command Center</p>
            </div>
          </div>
          <div className="mt-8 space-y-2 text-sm">
            {[
              { label: "Overview", count: data.overview?.guilds ?? 0 },
              { label: "Guilds", count: data.guilds.length },
              { label: "Repositories", count: data.repositories.length },
              { label: "Webhooks", count: data.webhooks.length },
              { label: "Channels", count: data.channels.length },
              { label: "Automation", count: 4 },
              { label: "Logs", count: 12 },
              { label: "Settings", count: 0 },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                className="w-full rounded-xl border border-transparent px-3 py-2 text-left text-discord-500 transition hover:border-white/5 hover:bg-discord-850 hover:text-discord-200"
              >
                <div className="flex items-center justify-between">
                  <span>{item.label}</span>
                  <span className="rounded-full bg-discord-800 px-2 py-0.5 text-xs text-discord-500">
                    {item.count}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-2xl border border-white/5 bg-discord-850 px-4 py-4">
            <p className="text-xs uppercase tracking-[0.2em] text-discord-500">Status</p>
            <p className="mt-2 text-sm text-discord-200">{status}</p>
            <button
              type="button"
              onClick={loadDashboard}
              className="mt-3 w-full rounded-lg bg-discord-blurple px-3 py-2 text-xs font-semibold text-white"
            >
              Refresh
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-discord-900 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-discord-500">GitCord</p>
              <h1 className="font-display text-2xl text-discord-200">Server Dashboard</h1>
            </div>
            <div className="relative flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex items-center gap-3 rounded-full border border-white/5 bg-discord-850 px-3 py-2"
              >
                {profile.discord ? (
                  <img
                    src={profile.discord.avatar_url}
                    alt={profile.discord.username}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-discord-800" />
                )}
                <div className="text-xs text-left">
                  <p className="text-discord-200">
                    {profile.discord?.username ?? "Admin User"}
                  </p>
                  <p className="text-discord-500">Menu</p>
                </div>
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-14 w-64 rounded-2xl border border-white/5 bg-discord-850 p-3 shadow-soft">
                  <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-discord-900 px-3 py-2 text-xs text-discord-500">
                    <span className="h-2 w-2 rounded-full bg-discord-green"></span>
                    {sessionInfo.discord_connected && sessionInfo.github_connected
                      ? "OAuth ready"
                      : "OAuth required"}
                  </div>
                  <a
                    href="/api/oauth/discord/login"
                    className="mt-2 block rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-xs text-discord-200"
                  >
                    Connect Discord
                  </a>
                  <a
                    href="/api/oauth/github/login"
                    className="mt-2 block rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-xs text-discord-200"
                  >
                    Connect GitHub
                  </a>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-xs text-discord-500 hover:text-discord-200 disabled:opacity-60"
                  >
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          <main className="flex-1 space-y-6 px-6 py-6">
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

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Guilds", value: data.overview?.guilds ?? 0 },
                { label: "Repositories", value: data.overview?.repositories ?? 0 },
                { label: "Channels", value: data.overview?.channels ?? 0 },
                { label: "Webhooks", value: data.overview?.webhook_configs ?? 0 },
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
              <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-discord-200">Guilds</h2>
                  <span className="text-xs text-discord-500">Latest 12</span>
                </div>
                <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-2">
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
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-discord-200">Repositories</h2>
                  <span className="text-xs text-discord-500">GitHub</span>
                </div>
                <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-2">
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
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-discord-200">Webhook Configs</h2>
                  <span className="text-xs text-discord-500">Latest 12</span>
                </div>
                <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-2">
                  {data.webhooks.length ? (
                    data.webhooks.map((webhook) => (
                      <div
                        key={webhook.id}
                        className="rounded-xl border border-white/5 bg-discord-900 px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-discord-200">
                          {webhook.repository_full_name} → {webhook.channel_id}
                        </p>
                        <p className="text-xs text-discord-500">
                          Slug: {webhook.secret_slug} | ID: {webhook.id}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-discord-500">No data yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg text-discord-200">Channels</h2>
                  <span className="text-xs text-discord-500">Latest 12</span>
                </div>
                <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-2">
                  {data.channels.length ? (
                    data.channels.map((channel) => (
                      <div
                        key={channel.id}
                        className="rounded-xl border border-white/5 bg-discord-900 px-4 py-3"
                      >
                        <p className="text-sm font-semibold text-discord-200">
                          {channel.name ?? "Unnamed channel"}
                        </p>
                        <p className="text-xs text-discord-500">
                          ID: {channel.channel_id}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-discord-500">No data yet.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg text-discord-200">Repository Notifications</h2>
                  <p className="text-xs text-discord-500">{repoStatus}</p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveRepos}
                  className="rounded-lg bg-discord-blurple px-4 py-2 text-xs font-semibold text-white"
                  disabled={!selectedGuild || !selectedChannel || selectedRepos.length === 0}
                >
                  Save Selection
                </button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="text-xs text-discord-500">
                  Discord Server
                  <div className="relative mt-2">
                    <button
                      type="button"
                      onClick={() => setGuildMenuOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-sm text-discord-200"
                    >
                      <span>
                        {selectedGuild
                          ? data.guilds.find((guild) => String(guild.id) === selectedGuild)?.name ??
                            `Guild ${selectedGuild}`
                          : "Select a server"}
                      </span>
                      <span className="text-discord-500">▾</span>
                    </button>
                    {guildMenuOpen ? (
                      <div className="absolute z-10 mt-2 w-full rounded-lg border border-white/10 bg-discord-900 p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGuild("");
                            setGuildMenuOpen(false);
                          }}
                          className="w-full rounded-md px-2 py-2 text-left text-xs text-discord-500 hover:bg-discord-850"
                        >
                          Select a server
                        </button>
                        <input
                          value={guildSearch}
                          onChange={(event) => setGuildSearch(event.target.value)}
                          placeholder="Search servers"
                          className="mt-2 w-full rounded-md border border-white/10 bg-discord-850 px-2 py-2 text-xs text-discord-200 outline-none focus:border-discord-blurple"
                        />
                        <div className="mt-2 max-h-48 overflow-y-auto">
                          {data.guilds
                            .filter((guild) =>
                              `${guild.name ?? ""} ${guild.id}`
                                .toLowerCase()
                                .includes(guildSearch.toLowerCase())
                            )
                            .map((guild) => (
                              <button
                                key={guild.id}
                                type="button"
                                onClick={() => {
                                  setSelectedGuild(String(guild.id));
                                  setGuildMenuOpen(false);
                                }}
                                className="w-full rounded-md px-2 py-2 text-left text-sm text-discord-200 hover:bg-discord-850"
                              >
                                {guild.name ?? `Guild ${guild.id}`}
                              </button>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </label>
                <label className="text-xs text-discord-500">
                  Channel
                  <div className="relative mt-2">
                    <button
                      type="button"
                      onClick={() => setChannelMenuOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-sm text-discord-200"
                    >
                      <span>
                        {selectedChannel
                          ? data.channels.find(
                              (channel) => String(channel.channel_id) === selectedChannel
                            )?.name ?? `Channel ${selectedChannel}`
                          : "Select a channel"}
                      </span>
                      <span className="text-discord-500">▾</span>
                    </button>
                    {channelMenuOpen ? (
                      <div className="absolute z-10 mt-2 w-full rounded-lg border border-white/10 bg-discord-900 p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChannel("");
                            setChannelMenuOpen(false);
                          }}
                          className="w-full rounded-md px-2 py-2 text-left text-xs text-discord-500 hover:bg-discord-850"
                        >
                          Select a channel
                        </button>
                        <input
                          value={channelSearch}
                          onChange={(event) => setChannelSearch(event.target.value)}
                          placeholder="Search channels"
                          className="mt-2 w-full rounded-md border border-white/10 bg-discord-850 px-2 py-2 text-xs text-discord-200 outline-none focus:border-discord-blurple"
                        />
                        <div className="mt-2 max-h-48 overflow-y-auto">
                          {data.channels
                            .filter((channel) =>
                              selectedGuild
                                ? String(channel.guild_id) === selectedGuild
                                : true
                            )
                            .filter((channel) =>
                              `${channel.name ?? ""} ${channel.channel_id}`
                                .toLowerCase()
                                .includes(channelSearch.toLowerCase())
                            )
                            .map((channel) => (
                              <button
                                key={channel.id}
                                type="button"
                                onClick={() => {
                                  setSelectedChannel(String(channel.channel_id));
                                  setChannelMenuOpen(false);
                                }}
                                className="w-full rounded-md px-2 py-2 text-left text-sm text-discord-200 hover:bg-discord-850"
                              >
                                {channel.name ?? `Channel ${channel.channel_id}`}
                              </button>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </label>
                <label className="text-xs text-discord-500">
                  Repositories
                  <div className="relative mt-2">
                    <button
                      type="button"
                      onClick={() => setRepoMenuOpen((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-sm text-discord-200"
                    >
                      <span>
                        {selectedRepos.length ? `${selectedRepos.length} selected` : "Select repositories"}
                      </span>
                      <span className="text-discord-500">▾</span>
                    </button>
                    {repoMenuOpen ? (
                      <div className="absolute z-10 mt-2 w-full rounded-lg border border-white/10 bg-discord-900 p-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRepos([]);
                          }}
                          className="w-full rounded-md px-2 py-2 text-left text-xs text-discord-500 hover:bg-discord-850"
                        >
                          Clear selection
                        </button>
                        <input
                          value={repoSearch}
                          onChange={(event) => setRepoSearch(event.target.value)}
                          placeholder="Search repositories"
                          className="mt-2 w-full rounded-md border border-white/10 bg-discord-850 px-2 py-2 text-xs text-discord-200 outline-none focus:border-discord-blurple"
                        />
                        <div className="mt-2 max-h-48 overflow-y-auto">
                          {data.repositories
                            .filter((repo) =>
                              repo.full_name.toLowerCase().includes(repoSearch.toLowerCase())
                            )
                            .map((repo) => (
                              <label
                                key={repo.id}
                                className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-discord-200 hover:bg-discord-850"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedRepos.includes(repo.full_name)}
                                  onChange={(event) => {
                                    setSelectedRepos((prev) =>
                                      event.target.checked
                                        ? [...prev, repo.full_name]
                                        : prev.filter((item) => item !== repo.full_name)
                                    );
                                  }}
                                />
                                {repo.full_name}
                              </label>
                            ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </label>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
