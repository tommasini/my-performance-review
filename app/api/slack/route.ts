import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { format, subDays } from 'date-fns';
import { runStandupPipeline } from '@/lib/standup-pipeline';
import { getSlackUserConfig, setSlackUserConfig, deleteSlackUserConfig } from '@/lib/slack-config';
import { DataSourceConfig, StandupConfig, UserProfile } from '@/app/types';

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Slack signature verification
// ---------------------------------------------------------------------------

async function verifySlackSignature(request: NextRequest, body: string): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.warn('[slack] SLACK_SIGNING_SECRET is not set — skipping signature check');
    return true;
  }

  const timestamp = request.headers.get('x-slack-request-timestamp');
  const signature = request.headers.get('x-slack-signature');

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes (replay attack prevention)
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (age > 300) return false;

  const sigBase = `v0:${timestamp}:${body}`;
  const computed = 'v0=' + createHmac('sha256', signingSecret).update(sigBase).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "key:value" pairs from a Slack slash command text string. Quoted values supported. */
function parseKVArgs(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /(\w+):(?:"([^"]+)"|(\S+))/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    result[match[1]] = (match[2] || match[3]).replace(/_/g, ' ');
  }
  return result;
}

/** Post a delayed response back to Slack via response_url */
async function postToSlack(responseUrl: string, text: string, inChannel = true): Promise<void> {
  await fetch(responseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      response_type: inChannel ? 'in_channel' : 'ephemeral',
      text,
    }),
  });
}

/** Calculate date range from standup frequency */
function dateRangeForFrequency(frequency: 'daily' | 'weekly'): { startDate: string; endDate: string } {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const startDate = frequency === 'daily'
    ? format(subDays(now, 1), 'yyyy-MM-dd')
    : format(subDays(now, 7), 'yyyy-MM-dd');
  return { startDate, endDate: today };
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

const HELP_TEXT = `*Standup Bot — commands*

*Generate your standup:*
\`/standup\` — generate for your configured frequency (daily/weekly)
\`/standup daily\` — force daily window (yesterday → today)
\`/standup weekly\` — force weekly window (last 7 days → today)

*First-time setup:*
\`/standup setup github_username:yourname github_token:ghp_xxx frequency:daily company:YourCompany position:"Senior Engineer"\`

Optional keys: \`organization:YourOrg\` \`ai_key:sk-ant-xxx\`

*Other:*
\`/standup status\` — show your current config (token masked)
\`/standup reset\` — delete your stored config
\`/standup help\` — show this message

_Your GitHub token is stored in Redis and never shared. Use a fine-grained PAT with read-only access to repos and pull-requests._`;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Read raw body (needed for signature verification)
  const rawBody = await request.text();

  // 2. Verify Slack signature
  const isValid = await verifySlackSignature(request, rawBody);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 3. Parse URL-encoded Slack payload
  const params = new URLSearchParams(rawBody);
  const userId = params.get('user_id') ?? '';
  const userName = params.get('user_name') ?? '';
  const rawText = (params.get('text') ?? '').trim();
  // Lowercase only for command keyword matching — preserve original casing for values
  // (tokens, org names, positions etc. are case-sensitive)
  const text = rawText.toLowerCase();
  const responseUrl = params.get('response_url') ?? '';

  if (!userId || !responseUrl) {
    return NextResponse.json({ text: 'Invalid Slack payload.' }, { status: 400 });
  }

  // 4. Dispatch

  // ── help ─────────────────────────────────────────────────────────────────
  if (text === 'help') {
    return NextResponse.json({ response_type: 'ephemeral', text: HELP_TEXT });
  }

  // ── status ───────────────────────────────────────────────────────────────
  if (text === 'status') {
    const config = await getSlackUserConfig(userId);
    if (!config) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: 'No config found. Run `/standup help` to set up.',
      });
    }
    const masked = config.githubToken.slice(0, 6) + '••••••••';
    return NextResponse.json({
      response_type: 'ephemeral',
      text: `*Your standup config:*\n` +
        `• GitHub username: \`${config.githubUsername}\`\n` +
        `• GitHub token: \`${masked}\`\n` +
        `• Frequency: \`${config.frequency}\`\n` +
        `• Organization: \`${config.organization || 'none'}\`\n` +
        `• Position: \`${config.currentPosition}\`\n` +
        `• Company: \`${config.companyName}\`\n` +
        `• AI key: ${config.aiKey ? '`set`' : '`not set (using server key)`'}`,
    });
  }

  // ── reset ────────────────────────────────────────────────────────────────
  if (text === 'reset') {
    await deleteSlackUserConfig(userId);
    return NextResponse.json({
      response_type: 'ephemeral',
      text: 'Your standup config has been deleted.',
    });
  }

  // ── setup ────────────────────────────────────────────────────────────────
  if (text.startsWith('setup')) {
    const args = parseKVArgs(rawText);

    const required = ['github_username', 'github_token', 'frequency', 'company', 'position'];
    const missing = required.filter(k => !args[k]);

    if (missing.length > 0) {
      // Load existing config to merge with — allows partial updates
      const existing = await getSlackUserConfig(userId);

      if (!existing && missing.length > 0) {
        return NextResponse.json({
          response_type: 'ephemeral',
          text: `Missing required fields: ${missing.map(k => `\`${k}\``).join(', ')}.\n\nExample:\n\`/standup setup github_username:yourname github_token:ghp_xxx frequency:daily company:Acme position:"Senior Engineer"\``,
        });
      }

      // Merge with existing config
      const merged = {
        githubUsername: args.github_username ?? existing!.githubUsername,
        githubToken: args.github_token ?? existing!.githubToken,
        frequency: (args.frequency ?? existing!.frequency) as 'daily' | 'weekly',
        organization: args.organization ?? existing!.organization,
        currentPosition: args.position ?? existing!.currentPosition,
        companyName: args.company ?? existing!.companyName,
        aiKey: args.ai_key ?? existing!.aiKey,
      };

      try {
        await setSlackUserConfig(userId, merged);
        return NextResponse.json({
          response_type: 'ephemeral',
          text: `Config updated for @${userName}. Run \`/standup\` to generate your standup.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ response_type: 'ephemeral', text: `Failed to save config: ${msg}` });
      }
    }

    const newConfig = {
      githubUsername: args.github_username,
      githubToken: args.github_token,
      frequency: args.frequency as 'daily' | 'weekly',
      organization: args.organization,
      currentPosition: args.position,
      companyName: args.company,
      aiKey: args.ai_key,
    };

    try {
      await setSlackUserConfig(userId, newConfig);
      return NextResponse.json({
        response_type: 'ephemeral',
        text: `Setup complete for @${userName}! Run \`/standup\` to generate your first standup.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ response_type: 'ephemeral', text: `Failed to save config: ${msg}` });
    }
  }

  // ── generate standup ─────────────────────────────────────────────────────
  const config = await getSlackUserConfig(userId);
  if (!config) {
    return NextResponse.json({
      response_type: 'ephemeral',
      text: `No config found for @${userName}. Run \`/standup help\` to get started.`,
    });
  }

  // Determine frequency (can be overridden by command text)
  const frequency: 'daily' | 'weekly' =
    text === 'weekly' ? 'weekly' : text === 'daily' ? 'daily' : config.frequency;

  const { startDate, endDate } = dateRangeForFrequency(frequency);

  // Acknowledge immediately — Slack requires a response within 3 seconds
  const ackText = `Generating your ${frequency} standup for @${userName}... ⏳ (${startDate} → ${endDate})\nThis takes 15–30 seconds.`;

  after(async () => {
    try {
      const dataSources: DataSourceConfig[] = [
        {
          type: 'github',
          enabled: true,
          username: config.githubUsername,
          token: config.githubToken,
          organization: config.organization,
        },
      ];

      const standupConfig: StandupConfig = { frequency };

      const profile: UserProfile = {
        currentPosition: config.currentPosition,
        targetPosition: '',
        companyName: config.companyName,
      };

      const message = await runStandupPipeline({
        dataSources,
        startDate,
        endDate,
        standupConfig,
        profile,
        userApiKey: config.aiKey,
      });

      await postToSlack(responseUrl, message, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[slack] Pipeline error:', msg);
      await postToSlack(responseUrl, `Failed to generate standup: ${msg}`, false);
    }
  });

  return NextResponse.json({ response_type: 'ephemeral', text: ackText });
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    slackConfigured: !!(process.env.SLACK_SIGNING_SECRET),
  });
}
