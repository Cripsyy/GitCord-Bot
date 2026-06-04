type SkeletonLineProps = {
  className?: string;
};

export function SkeletonLine({ className = "" }: SkeletonLineProps) {
  return (
    <div
      className={`animate-pulse rounded bg-discord-700 ${className}`}
    />
  );
}

type SkeletonCircleProps = {
  size?: string;
};

export function SkeletonCircle({ size = "h-10 w-10" }: SkeletonCircleProps) {
  return (
    <div className={`animate-pulse rounded-full bg-discord-700 ${size}`} />
  );
}

type SkeletonCardProps = {
  children?: React.ReactNode;
  className?: string;
};

export function SkeletonCard({ children, className = "" }: SkeletonCardProps) {
  return (
    <div
      className={`animate-pulse rounded-2xl border border-white/5 bg-discord-850 px-5 py-4 shadow-soft ${className}`}
    >
      {children}
    </div>
  );
}
