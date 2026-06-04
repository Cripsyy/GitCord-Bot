type DashboardSectionProps = {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

export default function DashboardSection({ title, action, children }: DashboardSectionProps) {
  return (
    <div className="rounded-2xl border border-white/5 bg-discord-850 px-5 py-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-discord-200">{title}</h2>
        {action ? action : null}
      </div>
      <div className="mt-4 h-64 space-y-3 overflow-y-auto pr-2">
        {children}
      </div>
    </div>
  );
}
