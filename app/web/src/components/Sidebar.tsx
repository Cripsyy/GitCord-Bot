import { useState } from "react";

function HomeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-90" : ""}`}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const topNavItems = [
  { label: "Overview", path: "/dashboard", icon: <HomeIcon /> },
  { label: "Configurations", path: "/configurations", icon: <GearIcon />, hasSubItems: true },
];

const configSubItems = [
  { label: "Webhooks", path: "/configurations/webhooks", icon: <GearIcon /> },
  { label: "Summaries", path: "/configurations/summaries", icon: <ClipboardIcon /> },
];

function Sidebar({ currentPath }: { currentPath: string }) {
  const isConfigActive = currentPath.startsWith("/configurations");
  const [configOpen, setConfigOpen] = useState(isConfigActive);

  return (
    <aside className="hidden w-[260px] flex-col border-r border-white/5 bg-discord-950 px-5 py-6 lg:flex">
      <div className="flex items-center gap-3 px-3 py-3 h-20 w-20">
        <img src="/dashboard/Logo/gitcord-logo.png" alt="GitCord" className="object-fill" />
        <span className="text-lg font-display text-discord-200">GitCord</span>
      </div>
      <div className="mt-8 space-y-1 text-sm">
        {topNavItems.map((item) => {
          const isActive = item.hasSubItems ? isConfigActive : currentPath === item.path;
          const Tag = item.hasSubItems ? "button" : "a";
          return (
            <Tag
              key={item.path}
              {...(item.hasSubItems ? {} : { href: item.path })}
              onClick={() => { if (item.hasSubItems) setConfigOpen((prev) => !prev); }}
              className={`flex items-center gap-3 w-full rounded-xl border px-3 py-2.5 text-left transition ${
                isActive
                  ? "border-discord-blurple/30 bg-discord-blurple/10 text-discord-200"
                  : "border-transparent text-discord-500 hover:border-white/5 hover:bg-discord-850 hover:text-discord-200"
              }`}
            >
              <span className="flex items-center justify-center w-5 h-5">{item.icon}</span>
              <span className={item.hasSubItems ? "flex-1" : ""}>{item.label}</span>
              {item.hasSubItems ? <ChevronIcon open={configOpen} /> : null}
            </Tag>
          );
        })}

        {configOpen ? (
          <div className="ml-4 space-y-1">
            {configSubItems.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  className={`flex items-center gap-3 w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    isActive
                      ? "border-discord-blurple/30 bg-discord-blurple/10 text-discord-200"
                      : "border-transparent text-discord-500 hover:border-white/5 hover:bg-discord-850 hover:text-discord-200"
                  }`}
                >
                  <span className="flex items-center justify-center w-5 h-5">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default Sidebar;
