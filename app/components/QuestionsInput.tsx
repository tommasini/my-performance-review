'use client';

import { useState, useEffect } from 'react';

interface QuestionsInputProps {
  customQuestions: string;
  setCustomQuestions: (questions: string) => void;
  companyValues: string;
  setCompanyValues: (values: string) => void;
  additionalContext: string;
  setAdditionalContext: (context: string) => void;
  claudeApiKey: string;
  setClaudeApiKey: (key: string) => void;
}

interface ServerAIStatus {
  hasClaudeKey: boolean;
  hasOpenAIKey: boolean;
  hasDeepSeekKey?: boolean;
  hasAnyKey: boolean;
  isLoading: boolean;
  error: string | null;
}

const EXAMPLE_QUESTIONS = `1. What progress have you made on your goals and objectives over the review period? Describe the impact on the success of your team, department, and organization.

2. How have you demonstrated leadership or mentorship in your role?

3. What skills or behaviors would you like to develop in the next review period?

4. Describe a challenging situation you faced and how you handled it.

5. How have you contributed to team culture and collaboration?`;

export default function QuestionsInput({
  customQuestions,
  setCustomQuestions,
  companyValues,
  setCompanyValues,
  additionalContext,
  setAdditionalContext,
  claudeApiKey,
  setClaudeApiKey,
}: QuestionsInputProps) {
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerAIStatus>({
    hasClaudeKey: false,
    hasOpenAIKey: false,
    hasAnyKey: true, // Assume true initially to avoid flash
    isLoading: true,
    error: null,
  });

  // Check if server has AI keys configured
  useEffect(() => {
    const checkServerKeys = async () => {
      try {
        const response = await fetch('/api/ai');
        if (response.ok) {
          const data = await response.json();
          const hasAnyKey = data.hasClaudeKey || data.hasOpenAIKey || data.hasDeepSeekKey;
          setServerStatus({
            hasClaudeKey: data.hasClaudeKey,
            hasOpenAIKey: data.hasOpenAIKey,
            hasDeepSeekKey: data.hasDeepSeekKey,
            hasAnyKey,
            isLoading: false,
            error: null,
          });
          // If no server keys, show the API key input by default
          if (!hasAnyKey) {
            setShowApiKeyInput(true);
          }
        } else {
          setServerStatus(prev => ({
            ...prev,
            hasAnyKey: false,
            isLoading: false,
            error: 'Could not check server status',
          }));
          setShowApiKeyInput(true);
        }
      } catch {
        setServerStatus(prev => ({
          ...prev,
          hasAnyKey: false,
          isLoading: false,
          error: 'Could not connect to server',
        }));
        setShowApiKeyInput(true);
      }
    };

    checkServerKeys();
  }, []);

  const loadExample = () => {
    setCustomQuestions(EXAMPLE_QUESTIONS);
  };

  return (
    <div className="space-y-6">
      {/* Questions Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">❓</span>
            Performance Review Questions
          </h2>
          <button
            onClick={loadExample}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
          >
            Load example
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Paste your company&apos;s performance review questions below. The AI will generate tailored answers for each question based on your contributions.
        </p>
        
        <textarea
          value={customQuestions}
          onChange={(e) => setCustomQuestions(e.target.value)}
          rows={10}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          placeholder={`Paste your performance review questions here. For example:

1. What progress have you made on your goals?
2. How have you demonstrated leadership?
3. What skills would you like to develop?

Each question should be on a new line, optionally numbered.`}
        />
        
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Questions can be numbered (1. 2. 3.) or bulleted (- • *)</span>
        </div>
      </div>

      {/* Company Values Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <span className="text-2xl">⭐</span>
          Company Values
          <span className="text-sm font-normal text-gray-400">(optional)</span>
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Add your company&apos;s core values so the AI can reference them when relevant.
        </p>
        
        <textarea
          value={companyValues}
          onChange={(e) => setCompanyValues(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          placeholder={`Example:
Innovation - We embrace creative solutions and new ideas
Collaboration - We work together to achieve common goals
Integrity - We act with honesty and transparency
Excellence - We strive for the highest quality in everything we do`}
        />
      </div>

      {/* Additional Context Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <span className="text-2xl">📝</span>
          Additional Context
          <span className="text-sm font-normal text-gray-400">(optional)</span>
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Add any context that won&apos;t be captured by your code contributions. The AI will use this to enrich your answers.
        </p>
        
        <textarea
          value={additionalContext}
          onChange={(e) => setAdditionalContext(e.target.value)}
          rows={5}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          placeholder={`Examples of things to include:
- Led migration from legacy system to new architecture
- Mentored 2 junior engineers during onboarding
- Presented at team tech talks about testing best practices
- Volunteered for on-call during holiday period
- Collaborated with design team on new feature specifications`}
        />
      </div>

      {/* API Key Section */}
      <div className={`rounded-xl border p-6 ${
        !serverStatus.isLoading && !serverStatus.hasAnyKey && !claudeApiKey
          ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300'
          : 'bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">🔑</span>
            AI API Key
            {serverStatus.hasAnyKey && (
              <span className="text-sm font-normal text-gray-400">(optional)</span>
            )}
            {!serverStatus.isLoading && !serverStatus.hasAnyKey && !claudeApiKey && (
              <span className="text-sm font-normal text-amber-600">(required)</span>
            )}
          </h2>
          {serverStatus.hasAnyKey && (
            <button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className="text-sm text-purple-600 hover:text-purple-700"
            >
              {showApiKeyInput ? 'Hide' : 'Show'}
            </button>
          )}
        </div>

        {/* Server status indicator */}
        {serverStatus.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Checking server configuration...</span>
          </div>
        ) : serverStatus.hasAnyKey ? (
          <p className="text-sm text-gray-600 mb-4">
            <span className="inline-flex items-center gap-1 text-green-600 font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Free tier available
            </span>
            {' '}- We provide <strong>limited free AI generations</strong> for everyone. Add your own Claude API key for unlimited access.
          </p>
        ) : (
          <div className="mb-4">
            <div className="flex items-start gap-2 p-3 bg-amber-100/50 rounded-lg border border-amber-200 mb-3">
              <span className="text-lg">⚠️</span>
              <div className="text-sm text-amber-800">
                <p className="font-medium">This instance requires your own API key</p>
                <p className="text-amber-700 mt-1">
                  No server AI keys are configured. Please provide your own Claude API key to use AI features.
                </p>
              </div>
            </div>
          </div>
        )}

        {(showApiKeyInput || !serverStatus.hasAnyKey) && (
          <div className="space-y-3">
            <input
              type="password"
              value={claudeApiKey}
              onChange={(e) => setClaudeApiKey(e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm ${
                !serverStatus.hasAnyKey && !claudeApiKey
                  ? 'border-amber-400 focus:ring-amber-500 focus:border-transparent bg-white'
                  : 'border-purple-300 focus:ring-purple-500 focus:border-transparent'
              }`}
              placeholder="sk-ant-..."
            />
            <p className="text-xs text-gray-500">
              Get your API key at{' '}
              <a
                href="https://console.anthropic.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
            {claudeApiKey && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>API key provided - you have unlimited access</span>
              </div>
            )}
          </div>
        )}

        {serverStatus.hasAnyKey && (
          <div className="mt-4 p-3 bg-white/60 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-lg">💡</span>
              <div className="text-xs text-gray-600">
                <p className="font-medium text-gray-700">Free tier limits</p>
                <p>15 AI generations per minute, 60 per day. Using your own key removes all limits.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

