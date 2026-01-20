import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, checkAbuse } from '@/lib/rate-limit';
import { generateAIResponse } from '@/lib/ai-providers';
import { buildPrompt } from '@/lib/prompt-builder';
import { ContributionData, ContributionStats, UserProfile } from '@/app/types';

export const maxDuration = 60; // Allow up to 60 seconds for AI response

interface AIRequestBody {
  question: string;
  contributions: ContributionData;
  stats: ContributionStats;
  profile: UserProfile;
  companyValues?: string;
  additionalContext?: string;
  userApiKey?: string; // User's own Claude API key (optional)
}

export async function POST(request: NextRequest) {
  try {
    // 1. Check for abuse patterns
    const abuseCheck = checkAbuse(request);
    if (!abuseCheck.allowed) {
      return NextResponse.json(
        { error: abuseCheck.reason || 'Request blocked' },
        { status: 403 }
      );
    }

    // 2. Parse request body
    const body: AIRequestBody = await request.json();
    const { question, contributions, stats, profile, companyValues, additionalContext, userApiKey } = body;

    // 3. Validate required fields
    if (!question || !contributions || !stats || !profile) {
      return NextResponse.json(
        { error: 'Missing required fields: question, contributions, stats, and profile are required' },
        { status: 400 }
      );
    }

    // 4. Rate limiting - only apply if using server key
    if (!userApiKey) {
      const rateLimitResult = await checkRateLimit(request);
      
      if (!rateLimitResult.success) {
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded. Please wait before making another request or use your own API key for unlimited access.',
            remaining: rateLimitResult.remaining,
            remainingDaily: rateLimitResult.remainingDaily,
            resetInSeconds: rateLimitResult.resetInSeconds,
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': rateLimitResult.resetInSeconds.toString(),
            }
          }
        );
      }

      // Include rate limit info in response headers
      const headers = new Headers();
      headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      headers.set('X-RateLimit-Remaining-Daily', rateLimitResult.remainingDaily.toString());
    }

    // 5. Build the prompt
    const prompt = buildPrompt(
      question,
      contributions,
      stats,
      profile,
      companyValues,
      additionalContext
    );

    // 6. Generate AI response with fallback
    const result = await generateAIResponse(prompt, userApiKey);

    // 7. Get updated rate limit info for response
    const updatedRateLimit = !userApiKey ? await checkRateLimit(request) : null;

    return NextResponse.json({
      answer: result.answer,
      provider: result.provider,
      notice: result.notice,
      rateLimit: updatedRateLimit ? {
        remaining: updatedRateLimit.remaining,
        remainingDaily: updatedRateLimit.remainingDaily,
      } : null,
    });

  } catch (error: any) {
    console.error('Error in AI route:', error);
    
    // Handle specific error types
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    if (error.message?.includes('unavailable')) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    hasClaudeKey: !!process.env.CLAUDE_API_KEY,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    hasDeepSeekKey: !!process.env.DEEPSEEK_API_KEY,
  });
}

