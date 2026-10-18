export type NansenCredentials = string | readonly string[] | NansenClient;

const REQUEST_TIMEOUT_MS = 60_000;
const TRANSIENT_ATTEMPTS = 2;

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function transientNetworkError(error: unknown) {
  return error instanceof Error &&
    /abort|timeout|network|fetch failed|socket|connection/i.test(
      `${error.name} ${error.message}`,
    );
}

async function post(
  url: string,
  payload: Record<string, unknown>,
  key: string,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < TRANSIENT_ATTEMPTS; attempt++) {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: key },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      lastError = error;
      if (!transientNetworkError(error) || attempt + 1 === TRANSIENT_ATTEMPTS)
        throw error;
      await wait(500 * 2 ** attempt);
    }
  }
  throw lastError;
}

export function nansenKeysFromEnv(env: Record<string, string | undefined>): string[] {
  return [...new Set([
    env.NANSEN_API_KEY,
    ...Object.keys(env)
      .filter((name) => /^NANSEN_API_KEY_?\d+$/.test(name))
      .sort((a, b) => Number(a.match(/\d+$/)![0]) - Number(b.match(/\d+$/)![0]))
      .map((name) => env[name]),
  ].map((key) => key?.trim()).filter((key): key is string => Boolean(key)))];
}

export class NansenClient {
  private readonly keys: string[];
  private readonly exhausted = new Map<string, number>();
  private active = 0;

  constructor(keys: string | readonly string[]) {
    this.keys = [...new Set((typeof keys === 'string' ? [keys] : keys)
      .map((key) => key.trim()).filter(Boolean))];
  }

  async request(url: string, payload: Record<string, unknown>, endpoint: string): Promise<Response> {
    const start = this.active;
    for (let offset = 0; offset < this.keys.length; offset++) {
      const index = (start + offset) % this.keys.length;
      const key = this.keys[index];
      if ((this.exhausted.get(key) ?? 0) > Date.now()) continue;
      const response = await post(url, payload, key);
      if (response.ok) return response;
      // Inspect errors locally, but never log provider bodies or credentials.
      const body = (await response.text()).toLowerCase().replace(/[_-]/g, ' ');
      const creditError = response.status === 402 ||
        ([400, 403, 429].includes(response.status) &&
          /(?:insufficient|exhausted|depleted|no remaining|not enough|out of)\s+(?:\w+\s+){0,3}credits?|credits?\s+(?:\w+\s+){0,3}(?:exhausted|depleted|exceeded|finished|insufficient)/.test(body));
      if (!creditError) throw new Error(`Nansen ${endpoint} request failed (${response.status}).`);
      // Recheck topped-up keys after five minutes; concurrent calls share this state.
      this.exhausted.set(key, Date.now() + 5 * 60_000);
      if (this.active === index) this.active = (index + 1) % this.keys.length;
    }
    throw new Error('Nansen credits are exhausted for all configured API keys. Add credits and retry in five minutes or restart the API.');
  }
}
