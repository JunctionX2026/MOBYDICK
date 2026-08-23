interface CloudflareEnv {
  DATA_GO_KR_KEY?: string;
  DATA_GO_KR_KEY_ENCODED?: string;
  GOVDATA_AI_ENABLED?: string;
  GOVDATA_AI_PROVIDER?: string;
  GOVDATA_LIVE_CACHE_ENABLED?: string;
  GOVDATA_LIVE_REPLAY?: string;
  GOVDATA_OPENAI_TIMEOUT_SECONDS?: string;
  LIVE_API_TIMEOUT_SECONDS?: string;
  OPENAI_API_KEY?: string;
  OPENAI_API_MODEL?: string;
  OPENAI_REASONING_EFFORT?: string;
}

declare namespace Cloudflare {
  interface Env {
    DATA_GO_KR_KEY?: string;
    DATA_GO_KR_KEY_ENCODED?: string;
  }
}
