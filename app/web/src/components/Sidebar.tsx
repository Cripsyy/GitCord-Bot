import type { Overview } from "../types";

type SidebarProps = {
  overview: Overview | null;
  status: string;
  onRefresh: () => void;
  currentPath: string;
};

const navItems = [
  { label: "Overview", path: "/dashboard", icon: "◉" },
  { label: "Configurations", path: "/configurations", icon: "⚙" },
];

function Sidebar({ overview, status, onRefresh, currentPath }: SidebarProps) {
  return (
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
      <div className="mt-8 space-y-1 text-sm">
        {navItems.map((item) => {
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
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          );
        })}
      </div>
      {overview ? (
        <div className="mt-6 space-y-2 border-t border-white/5 pt-6">
          {[
            { label: "Guilds", value: overview.guilds },
            { label: "Repos", value: overview.repositories },
            { label: "Channels", value: overview.channels },
            { label: "Webhooks", value: overview.webhook_configs },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center justify-between text-xs">
              <span className="text-discord-500">{stat.label}</span>
              <span className="rounded-full bg-discord-800 px-2 py-0.5 text-discord-400">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-auto rounded-2xl border border-white/5 bg-discord-850 px-4 py-4">
        <p className="text-xs uppercase tracking-[0.2em] text-discord-500">Status</p>
        <p className="mt-2 text-sm text-discord-200">{status}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="mt-3 w-full rounded-lg bg-discord-blurple px-3 py-2 text-xs font-semibold text-white"
        >
          Refresh
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
