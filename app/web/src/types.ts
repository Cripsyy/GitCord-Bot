export type Overview = {
  guilds: number;
  repositories: number;
  channels: number;
  webhook_configs: number;
};

export type Guild = {
  id: number;
  name: string | null;
  ai_summary_enabled: boolean;
  ai_max_diff_chars: number;
  llm_model: string | null;
  created_at: string | null;
};

export type Repository = {
  id: number;
  guild_id: number;
  full_name: string;
  created_at: string | null;
};

export type WebhookConfig = {
  id: number;
  guild_id: number;
  secret_slug: string;
  repository_full_name: string;
  channel_id: number;
  ai_summary_enabled: boolean;
  ai_max_diff_chars: number;
  llm_model: string | null;
  created_at?: string | null;
};

export type Channel = {
  id: number;
  guild_id: number;
  channel_id: number;
  name: string | null;
  created_at: string | null;
};
