import Redis from 'ioredis';

export interface SlackUserConfig {
  githubUsername: string;
  githubToken: string;
  frequency: 'daily' | 'weekly';
  organization?: string;
  currentPosition: string;
  companyName: string;
  aiKey?: string;
}

let client: Redis | null = null;
let connectionFailed = false;

function getClient(): Redis | null {
  if (connectionFailed) return null;
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const isUpstash = url.includes('upstash');
    client = new Redis(url, {
      maxRetriesPerRequest: 2,
      connectTimeout: 8000,
      lazyConnect: true,
      retryStrategy: (times) => (times > 2 ? null : times * 200),
      ...(isUpstash || url.startsWith('rediss://') ? { tls: {} } : {}),
    });

    client.on('error', (err) => {
      console.error('[slack-config] Redis error:', err.message);
      connectionFailed = true;
      client = null;
    });

    client.connect().catch((err) => {
      console.warn('[slack-config] Redis unavailable:', err.message);
      connectionFailed = true;
      client = null;
    });

    return client;
  } catch {
    connectionFailed = true;
    return null;
  }
}

const key = (slackUserId: string) => `slack-user:${slackUserId}`;

export async function getSlackUserConfig(slackUserId: string): Promise<SlackUserConfig | null> {
  const redis = getClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(key(slackUserId));
    if (!raw) return null;
    return JSON.parse(raw) as SlackUserConfig;
  } catch {
    return null;
  }
}

export async function setSlackUserConfig(slackUserId: string, config: SlackUserConfig): Promise<void> {
  const redis = getClient();
  if (!redis) {
    throw new Error(
      'Redis is not available. Set REDIS_URL in your environment to persist Slack configuration.'
    );
  }
  await redis.set(key(slackUserId), JSON.stringify(config));
}

export async function deleteSlackUserConfig(slackUserId: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  await redis.del(key(slackUserId));
}
