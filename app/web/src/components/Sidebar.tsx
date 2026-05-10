type SidebarProps = {
  currentPath: string;
};

const navItems = [
  { label: "Overview", path: "/dashboard", icon: "◉" },
  { label: "Configurations", path: "/configurations", icon: "⚙" },
];

function Sidebar({currentPath }: SidebarProps) {
  return (
    <aside className="hidden w-[260px] flex-col border-r border-white/5 bg-discord-950 px-5 py-6 lg:flex">
      <div className="flex items-center gap-3 px-3 py-3 h-20 w-20">
        <img src="/dashboard/Logo/gitcord-logo.png" alt="GitCord" className="object-fill" />
        <span className="text-lg font-display text-discord-200">GitCord</span>
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
    </aside>
  );
}

export default Sidebar;
