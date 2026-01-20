export type AIProvider = 'claude' | 'openai' | 'deepseek';

export interface AIProviderError extends Error {
  status?: number;
  isOverloaded?: boolean;
  isRateLimited?: boolean;
}

export async function generateWithClaude(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || 'Claude API error') as AIProviderError;
    error.status = response.status;
    error.isOverloaded = 
      data.error?.type === 'overloaded_error' || 
      data.error?.message?.toLowerCase().includes('overloaded') ||
      response.status === 529;
    error.isRateLimited = response.status === 429;
    throw error;
  }

  return data.content[0].text;
}

export async function generateWithOpenAI(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || 'OpenAI API error') as AIProviderError;
    error.status = response.status;
    error.isOverloaded = response.status === 503;
    error.isRateLimited = response.status === 429;
    throw error;
  }

  return data.choices[0].message.content;
}

/**
 * Generate text using DeepSeek API
 * DeepSeek offers very affordable pricing (~$0.14/M input tokens)
 * API is OpenAI-compatible
 * Sign up at: https://platform.deepseek.com
 */
export async function generateWithDeepSeek(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || 'DeepSeek API error') as AIProviderError;
    error.status = response.status;
    error.isOverloaded = response.status === 503 || response.status === 529;
    error.isRateLimited = response.status === 429;
    throw error;
  }

  return data.choices[0].message.content;
}

export interface AIResponseResult {
  answer: string;
  provider: AIProvider;
  notice?: string;
}

/**
 * Main function that tries providers in order: Claude -> OpenAI -> DeepSeek
 * Falls back to the next provider if the current one is overloaded or rate limited
 */
export async function generateAIResponse(
  prompt: string,
  userClaudeKey?: string
): Promise<AIResponseResult> {
  const serverClaudeKey = process.env.CLAUDE_API_KEY;
  const serverOpenAIKey = process.env.OPENAI_API_KEY;
  const serverDeepSeekKey = process.env.DEEPSEEK_API_KEY;
  
  // Determine which Claude key to use
  const claudeKey = userClaudeKey || serverClaudeKey;
  
  // Check if we have any AI provider available
  if (!claudeKey && !serverOpenAIKey && !serverDeepSeekKey) {
    throw new Error('No AI API key available. Please provide your own Claude API key.');
  }

  const errors: string[] = [];

  // Try Claude first (if available)
  if (claudeKey) {
    try {
      const answer = await generateWithClaude(prompt, claudeKey);
      return { answer, provider: 'claude' };
    } catch (claudeError) {
      const err = claudeError as AIProviderError;
      errors.push(`Claude: ${err.message}`);
      
      // Only continue to fallback if overloaded or rate limited
      if (!err.isOverloaded && !err.isRateLimited) {
        throw claudeError;
      }
      console.log('Claude unavailable, trying fallback...');
    }
  }

  // Try OpenAI as first fallback (if available)
  if (serverOpenAIKey) {
    try {
      const answer = await generateWithOpenAI(prompt, serverOpenAIKey);
      return { 
        answer, 
        provider: 'openai',
        notice: 'Generated using OpenAI due to high demand on primary provider'
      };
    } catch (openaiError) {
      const err = openaiError as AIProviderError;
      errors.push(`OpenAI: ${err.message}`);
      
      if (!err.isOverloaded && !err.isRateLimited) {
        throw openaiError;
      }
      console.log('OpenAI unavailable, trying DeepSeek...');
    }
  }

  // Try DeepSeek as final fallback (if available)
  if (serverDeepSeekKey) {
    try {
      const answer = await generateWithDeepSeek(prompt, serverDeepSeekKey);
      return { 
        answer, 
        provider: 'deepseek',
        notice: 'Generated using DeepSeek due to high demand on other providers'
      };
    } catch (deepseekError) {
      const err = deepseekError as AIProviderError;
      errors.push(`DeepSeek: ${err.message}`);
    }
  }

  // All providers failed
  throw new Error(`All AI services are currently unavailable. Errors: ${errors.join('; ')}`);
}
