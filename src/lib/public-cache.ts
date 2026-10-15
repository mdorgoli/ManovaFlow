import { createClient } from "redis";

function createPublicRedis(url: string) {
  return createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: 2000, reconnectStrategy: false }
  });
}

type RedisClient = ReturnType<typeof createPublicRedis>;
const shared = globalThis as typeof globalThis & {
  manovaPublicRedis?: Promise<RedisClient>;
};

export async function getPublicCache(): Promise<RedisClient | undefined> {
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  if (!shared.manovaPublicRedis) {
    const client = createPublicRedis(url);
    client.on("error", () => {
      /* Cache errors must not expose credentials. */
    });
    shared.manovaPublicRedis = client
      .connect()
      .then(() => client)
      .catch((error: unknown) => {
        delete shared.manovaPublicRedis;
        throw error;
      });
  }
  const client = await shared.manovaPublicRedis;
  if (!client.isReady) {
    delete shared.manovaPublicRedis;
    return getPublicCache();
  }
  return client;
}

// Only public language options are stored here; no tenant, auth or financial data.
export async function cachedPublicLocales<T>(load: () => T): Promise<{
  value: T;
  cache: "HIT" | "MISS" | "BYPASS";
}> {
  try {
    const client = await getPublicCache();
    if (client) {
      const key = "manovaflow:public:locales:v1";
      const cached = await client.get(key);
      if (cached) return { value: JSON.parse(cached) as T, cache: "HIT" };
      const value = load();
      await client.set(key, JSON.stringify(value), { EX: 60 });
      return { value, cache: "MISS" };
    }
  } catch {
    /* Public data remains available if optional Redis cache is down. */
  }
  return { value: load(), cache: "BYPASS" };
}
