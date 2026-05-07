export type Overview = {
  guilds: number;
  repositories: number;
  channels: number;
  webhook_configs: number;
};

export type Guild = {
  id: string;
  name: string | null;
  ai_summary_enabled: boolean;
  ai_max_diff_chars: number;
  llm_model: string | null;
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
  llm_model: string | null;
  created_at?: string | null;
};

export type Channel = {
  id: string;
  guild_id: string;
  channel_id: string;
  name: string | null;
  created_at: string | null;
};
