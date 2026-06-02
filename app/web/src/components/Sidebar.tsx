import { useState } from "react";
import { Link } from "react-router-dom";
import { HomeIcon, GearIcon, ClipboardIcon, LinkIcon, TrophyIcon, ChevronIcon } from "./Icons";

const topNavItems = [
  { label: "Overview", path: "/dashboard", icon: <HomeIcon /> },
  { label: "Leaderboard", path: "/leaderboard", icon: <TrophyIcon /> },
  { label: "Configurations", path: "/configurations", icon: <GearIcon />, hasSubItems: true },
];

const configSubItems = [
  { label: "Connections", path: "/configurations/connections", icon: <LinkIcon /> },
  { label: "Summaries", path: "/configurations/summaries", icon: <ClipboardIcon /> },
  { label: "Leaderboard", path: "/configurations/leaderboard", icon: <TrophyIcon /> },
];

const navItemClass = (isActive: boolean) =>
  `flex items-center gap-3 w-full rounded-xl border px-3 py-2.5 text-left transition ${
    isActive
      ? "border-discord-blurple text-discord-200"
      : "border-transparent text-discord-500 hover:border-discord-blurple hover:text-discord-200"
  }`;

function Sidebar({ currentPath }: { currentPath: string }) {
  const isConfigActive = currentPath.startsWith("/configurations");
  const [configOpen, setConfigOpen] = useState(isConfigActive);

  return (
    <aside className="hidden w-[260px] flex-col border-r border-white/5 bg-discord-950 px-4 py-4 lg:flex">
      <div className="flex items-center gap-3 px-3 pb-3 h-20 w-20">
        <img src="/Logo/gitcord-logo.png" alt="GitCord" className="object-fill" />
        <span className="text-xl font-display text-discord-200">GitCord</span>
      </div>
      <div className="mt-6 space-y-1 text-sm">
        {topNavItems.map((item) => {
          const isActive = item.hasSubItems ? isConfigActive : currentPath === item.path;

          if (item.hasSubItems) {
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => setConfigOpen((prev) => !prev)}
                className={navItemClass(isActive)}
              >
                <span className="flex items-center justify-center w-5 h-5">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <ChevronIcon open={configOpen} />
              </button>
            );
          }

          return (
            <Link key={item.path} to={item.path} className={navItemClass(isActive)}>
              <span className="flex items-center justify-center w-5 h-5">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        {configOpen ? (
          <div className="ml-4 space-y-1">
            {configSubItems.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={navItemClass(isActive)}
                >
                  <span className="flex items-center justify-center w-5 h-5">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export default Sidebar;
