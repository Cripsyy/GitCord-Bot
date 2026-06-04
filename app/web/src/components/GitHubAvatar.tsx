import { useState } from "react";

type GitHubAvatarProps = {
  username: string;
  sizeClass: string;
  fallback: React.ReactNode;
};

export default function GitHubAvatar({ username, sizeClass, fallback }: GitHubAvatarProps) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={`shrink-0 flex items-center justify-center rounded-full bg-discord-800 text-discord-200 font-bold border border-white/10 ${sizeClass}`}
      >
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={`https://github.com/${username}.png`}
      alt={username}
      onError={() => setError(true)}
      className={`shrink-0 rounded-full border border-white/10 object-cover ${sizeClass}`}
    />
  );
}
