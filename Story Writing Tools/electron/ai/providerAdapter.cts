export type AiProviderType = "Gemini" | "OpenAI" | "Anthropic" | "CustomOpenAI";

export interface ProviderConnectionConfig {
  providerType: AiProviderType;
  baseUrl?: string | null;
  modelName: string;
  apiKey?: string | null;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  statusCode?: number;
  message: string;
}

export interface GenerateTextRequest {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTextResponse {
  text: string;
  model: string;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function normalizeBaseUrl(rawUrl: string): string {
  return rawUrl.trim().replace(/\/+$/, "");
}

function extractErrorDetail(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    if (parsed.error?.message) return parsed.error.message;
    if (parsed.message) return parsed.message;
  } catch {
    // Plain text fallback
  }
  return bodyText.slice(0, 220).trim();
}

export async function testProviderConnection(
  config: ProviderConnectionConfig
): Promise<ConnectionTestResult> {
  const startedAt = Date.now();
  const model = config.modelName.trim();
  const apiKey = (config.apiKey ?? "").trim();

  if (!model) {
    return {
      ok: false,
      latencyMs: 0,
      message: "Model name is required.",
    };
  }

  try {
    if (config.providerType === "Gemini") {
      if (!apiKey) {
        return { ok: false, latencyMs: 0, message: "Gemini API key is required." };
      }
      const cleanModel = model.startsWith("models/") ? model : `models/${model}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURI(cleanModel)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      const latencyMs = Date.now() - startedAt;
      if (!res.ok) {
        const detail = extractErrorDetail(await res.text());
        return {
          ok: false,
          latencyMs,
          statusCode: res.status,
          message: detail || `HTTP ${res.status}`,
        };
      }
      return {
        ok: true,
        latencyMs,
        statusCode: res.status,
        message: `Connected to Gemini (${model}).`,
      };
    }

    if (config.providerType === "OpenAI") {
      if (!apiKey) {
        return { ok: false, latencyMs: 0, message: "OpenAI API key is required." };
      }
      const url = `https://api.openai.com/v1/models/${encodeURIComponent(model)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      const latencyMs = Date.now() - startedAt;
      if (!res.ok) {
        const detail = extractErrorDetail(await res.text());
        return {
          ok: false,
          latencyMs,
          statusCode: res.status,
          message: detail || `HTTP ${res.status}`,
        };
      }
      return {
        ok: true,
        latencyMs,
        statusCode: res.status,
        message: `Connected to OpenAI (${model}).`,
      };
    }

    if (config.providerType === "Anthropic") {
      if (!apiKey) {
        return {
          ok: false,
          latencyMs: 0,
          message: "Anthropic API key is required.",
        };
      }
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
      const latencyMs = Date.now() - startedAt;
      if (!res.ok) {
        const detail = extractErrorDetail(await res.text());
        return {
          ok: false,
          latencyMs,
          statusCode: res.status,
          message: detail || `HTTP ${res.status}`,
        };
      }
      return {
        ok: true,
        latencyMs,
        statusCode: res.status,
        message: `Connected to Anthropic (${model}).`,
      };
    }

    // CustomOpenAI (Ollama, LM Studio, OpenRouter, DeepSeek, Groq, etc.)
    const baseUrl = normalizeBaseUrl(config.baseUrl ?? "");
    if (!baseUrl) {
      return {
        ok: false,
        latencyMs: 0,
        message: "Base URL is required for Custom OpenAI-Compatible providers.",
      };
    }

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const modelsRes = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (modelsRes.ok) {
      const latencyMs = Date.now() - startedAt;
      return {
        ok: true,
        latencyMs,
        statusCode: modelsRes.status,
        message: `Connected to ${baseUrl} (${model}).`,
      };
    }

    // Fallback ping via /chat/completions if /models is not exposed
    const chatRes = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    const latencyMs = Date.now() - startedAt;
    if (!chatRes.ok) {
      const detail = extractErrorDetail(await chatRes.text());
      return {
        ok: false,
        latencyMs,
        statusCode: chatRes.status,
        message: detail || `HTTP ${chatRes.status}`,
      };
    }

    return {
      ok: true,
      latencyMs,
      statusCode: chatRes.status,
      message: `Connected to ${baseUrl} (${model}).`,
    };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const message =
      err instanceof Error ? err.message : "Connection failed unexpectedly.";
    return { ok: false, latencyMs, message };
  }
}

/**
 * Unified text generation adapter (used by Phases 7 & 8).
 */
export async function generateText(
  config: ProviderConnectionConfig,
  request: GenerateTextRequest
): Promise<GenerateTextResponse> {
  const model = config.modelName.trim();
  const apiKey = (config.apiKey ?? "").trim();

  if (config.providerType === "Gemini") {
    const cleanModel = model.startsWith("models/") ? model : `models/${model}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${encodeURI(cleanModel)}:generateContent`;
    const body: Record<string, unknown> = {
      contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        ...(request.maxTokens ? { maxOutputTokens: request.maxTokens } : {}),
      },
    };
    if (request.systemPrompt) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(extractErrorDetail(await res.text()) || `HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return { text, model };
  }

  if (config.providerType === "Anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
        messages: [{ role: "user", content: request.userPrompt }],
      }),
    });
    if (!res.ok) {
      throw new Error(extractErrorDetail(await res.text()) || `HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text =
      json.content
        ?.filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("") ?? "";
    return { text, model };
  }

  // OpenAI & CustomOpenAI
  const baseUrl =
    config.providerType === "OpenAI"
      ? "https://api.openai.com/v1"
      : normalizeBaseUrl(config.baseUrl ?? "");

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const messages: Array<{ role: string; content: string }> = [];
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  messages.push({ role: "user", content: request.userPrompt });

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      temperature: request.temperature ?? 0.7,
      ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
      messages,
    }),
  });
  if (!res.ok) {
    throw new Error(extractErrorDetail(await res.text()) || `HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  return { text, model };
}
