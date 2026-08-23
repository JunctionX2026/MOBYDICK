import { env } from "cloudflare:workers";
import { Container, getContainer } from "@cloudflare/containers";

export class GovDataContainer extends Container {
  defaultPort = 8000;
  sleepAfter = "10m";
  enableInternet = true;
  envVars = {
    DATA_GO_KR_KEY: env.DATA_GO_KR_KEY ?? "",
    DATA_GO_KR_KEY_ENCODED: env.DATA_GO_KR_KEY_ENCODED ?? "",
    GOVDATA_AI_ENABLED: env.GOVDATA_AI_ENABLED ?? "false",
    GOVDATA_AI_PROVIDER: env.GOVDATA_AI_PROVIDER ?? "openai",
    GOVDATA_LIVE_CACHE_ENABLED: env.GOVDATA_LIVE_CACHE_ENABLED ?? "true",
    GOVDATA_LIVE_REPLAY: env.GOVDATA_LIVE_REPLAY ?? "false",
    LIVE_API_TIMEOUT_SECONDS: env.LIVE_API_TIMEOUT_SECONDS ?? "30",
    OPENAI_API_KEY: env.OPENAI_API_KEY ?? "",
    OPENAI_API_MODEL: env.OPENAI_API_MODEL ?? "gpt-5.6-luna",
    OPENAI_REASONING_EFFORT: env.OPENAI_REASONING_EFFORT ?? "low",
    GOVDATA_OPENAI_TIMEOUT_SECONDS: env.GOVDATA_OPENAI_TIMEOUT_SECONDS ?? "30",
  };
}

export default {
  async fetch(request: Request, runtimeEnv: CloudflareEnv): Promise<Response> {
    return getContainer(runtimeEnv.GOVDATA_CONTAINER, "default").fetch(request);
  },
};
