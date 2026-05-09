import { useEffect, useRef, useState } from "react";
import type { Profile, SessionInfo } from "../types";

type NavbarProps = {
  title: string;
};

function Navbar({ title }: NavbarProps) {
  const [profile, setProfile] = useState<Profile>({ discord: null });
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    discord_connected: false,
    github_connected: false,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [disconnectingDiscord, setDisconnectingDiscord] = useState(false);
  const [disconnectingGithub, setDisconnectingGithub] = useState(false);
  const menuAreaRef = useRef<HTMLDivElement>(null);

  async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }
    return response.json() as Promise<T>;
  }

  async function loadSession() {
    try {
      const session = await fetchJson<SessionInfo>("/api/dashboard/session");
      setSessionInfo(session);
    } catch {
      /* ignore */
    }
  }

  async function loadProfile() {
    try {
      const profileData = await fetchJson<Profile>("/api/dashboard/profile");
      setProfile(profileData);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadSession();
    loadProfile();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuOpen && menuAreaRef.current && !menuAreaRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  async function handleDisconnectDiscord() {
    setDisconnectingDiscord(true);
    try {
      await fetch("/api/oauth/disconnect/discord", { method: "POST" });
      setSessionInfo((prev) => ({ ...prev, discord_connected: false }));
      setProfile({ discord: null });
    } catch {
      /* ignore */
    } finally {
      setDisconnectingDiscord(false);
    }
  }

  async function handleDisconnectGithub() {
    setDisconnectingGithub(true);
    try {
      await fetch("/api/oauth/disconnect/github", { method: "POST" });
      setSessionInfo((prev) => ({ ...prev, github_connected: false }));
    } catch {
      /* ignore */
    } finally {
      setDisconnectingGithub(false);
    }
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-discord-900 px-6 py-5">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-discord-500">GitCord</p>
        <h1 className="font-display text-2xl text-discord-200">{title}</h1>
      </div>
      <div className="relative flex flex-wrap items-center gap-3" ref={menuAreaRef}>
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
          <div className="text-left text-xs">
            <p className="text-discord-200">{profile.discord?.username ?? "Admin User"}</p>
            <p className="text-discord-500">Menu</p>
          </div>
        </button>
        {menuOpen ? (
          <div className="absolute right-0 top-14 z-10 w-72 rounded-2xl border border-white/5 bg-discord-850 p-3 shadow-soft">
            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-discord-900 px-3 py-2 text-xs">
              <span className="text-discord-500">Discord</span>
              <span className={`flex items-center gap-1.5 ${sessionInfo.discord_connected ? "text-discord-green" : "text-red-400"}`}>
                <span className={`h-2 w-2 rounded-full ${sessionInfo.discord_connected ? "bg-discord-green" : "bg-red-400"}`} />
                {sessionInfo.discord_connected ? "Connected" : "Not Connected"}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between rounded-lg border border-white/5 bg-discord-900 px-3 py-2 text-xs">
              <span className="text-discord-500">GitHub</span>
              <span className={`flex items-center gap-1.5 ${sessionInfo.github_connected ? "text-discord-green" : "text-red-400"}`}>
                <span className={`h-2 w-2 rounded-full ${sessionInfo.github_connected ? "bg-discord-green" : "bg-red-400"}`} />
                {sessionInfo.github_connected ? "Connected" : "Not Connected"}
              </span>
            </div>

            <div className="mt-2 space-y-1">
              {!sessionInfo.discord_connected ? (
                <a
                  href="/api/oauth/discord/login"
                  className="block rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-xs text-discord-200 hover:bg-discord-800"
                >
                  Connect Discord
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleDisconnectDiscord}
                  disabled={disconnectingDiscord}
                  className="w-full rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-xs text-red-400 hover:bg-discord-800 disabled:opacity-60"
                >
                  {disconnectingDiscord ? "Disconnecting..." : "Disconnect Discord"}
                </button>
              )}
              {!sessionInfo.github_connected ? (
                <a
                  href="/api/oauth/github/login"
                  className="block rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-xs text-discord-200 hover:bg-discord-800"
                >
                  Connect GitHub
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleDisconnectGithub}
                  disabled={disconnectingGithub}
                  className="w-full rounded-lg border border-white/10 bg-discord-900 px-3 py-2 text-xs text-red-400 hover:bg-discord-800 disabled:opacity-60"
                >
                  {disconnectingGithub ? "Disconnecting..." : "Disconnect GitHub"}
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export default Navbar;
