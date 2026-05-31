export type Overview = {
  guilds: number;
  repositories: number;
  channels: number;
  webhook_configs: number;
  summary_configs: number;
  leaderboard_entries: number;
};

export type Guild = {
  id: string;
  name: string | null;
  ai_summary_enabled: boolean;
  ai_max_diff_chars: number;
  created_at: string | null;
};

export type Repository = {
  id: string;
  full_name: string;
  private: boolean;
  html_url: string;
};

export type WebhookConfig = {
  id: string;
  guild_id: string;
  secret_slug: string;
  repository_full_name: string;
  channel_id: string;
  ai_summary_enabled: boolean;
  ai_max_diff_chars: number;
  events: string[];
  created_at?: string | null;
};

export type Profile = {
  discord: {
    id: string;
    username: string;
    avatar_url: string;
  } | null;
};

export type SessionInfo = {
  discord_connected: boolean;
  github_connected: boolean;
  discord_expired: boolean;
  github_expired: boolean;
};

export type Channel = {
  id: string;
  guild_id: string;
  channel_id: string;
  name: string | null;
  created_at: string | null;
};

export type SummaryConfig = {
  id: string;
  guild_id: string;
  channel_id: string;
  send_time: string;
  include_prs: boolean;
  include_issues: boolean;
  include_standups: boolean;
  enabled: boolean;
  created_at: string | null;
};

export type LeaderboardEntry = {
  id: string;
  guild_id: string;
  github_user: string;
  discord_user_id: string | null;
  user_name: string | null;
  xp: number;
  level: number;
};

export type LeaderboardConfig = {
  id: string;
  guild_id: string;
  enabled: boolean;
  base_xp: number;
  start_increment: number;
  increment_step: number;
  xp_settings: Record<string, number>;
  role_milestones: LeaderboardRoleMilestone[];
};

export type LeaderboardRoleMilestone = {
  level: number;
  role_name: string;
  remove_previous: boolean;
};
