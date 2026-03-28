import { env } from "../config/env.js";

type OpenClawHealth =
  | {
      configured: false;
      reachable: false;
    }
  | {
      configured: true;
      reachable: boolean;
      statusCode?: number;
      message?: string;
    };

class OpenClawService {
  private readonly baseUrl = env.OPENCLAW_BASE_URL;
  private readonly apiKey = env.OPENCLAW_API_KEY;
  private readonly timeoutMs = env.OPENCLAW_TIMEOUT_MS;

  async health(): Promise<OpenClawHealth> {
    if (!this.baseUrl || !this.apiKey) {
      return {
        configured: false,
        reachable: false,
      };
    }

    try {
      const response = await fetch(new URL("/health", this.baseUrl), {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      return {
        configured: true,
        reachable: response.ok,
        statusCode: response.status,
        message: response.ok ? "OpenClaw reachable" : "OpenClaw returned non-OK status",
      };
    } catch (error) {
      return {
        configured: true,
        reachable: false,
        message: error instanceof Error ? error.message : "OpenClaw request failed",
      };
    }
  }
}

export const openClawService = new OpenClawService();
