'use client';

import { useState } from 'react';
import { FetchedData, UserProfile, StandupConfig } from '@/app/types';
import ContributionsView from './ContributionsView';

interface StandupReviewProps {
  data: FetchedData;
  profile: UserProfile;
  standupConfig: StandupConfig;
  claudeApiKey: string;
  setClaudeApiKey: (key: string) => void;
}

export default function StandupReview({
  data,
  profile,
  standupConfig,
  claudeApiKey,
  setClaudeApiKey,
}: StandupReviewProps) {
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [localApiKey, setLocalApiKey] = useState('');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setAiNotice(null);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'standup',
          contributions: data.contributions,
          stats: data.stats,
          profile,
          standupConfig,
          userApiKey: claudeApiKey || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'AI generation failed');
      }

      if (result.notice) {
        setAiNotice(result.notice);
      }

      // The AI now returns plain-text directly — no JSON parsing needed
      setGeneratedText(result.answer || '');
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'An error occurred while generating the standup.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const filename = `standup-${standupConfig.frequency}-${new Date().toISOString().split('T')[0]}.txt`;
    const blob = new Blob([generatedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasOutput = generatedText.trim().length > 0;

  return (
    <div className="space-y-6">
      <ContributionsView data={data} />

      {/* Standup Builder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">📋</span>
              Async Standup
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {standupConfig.frequency === 'daily' ? 'Daily' : 'Weekly'} update
              {standupConfig.milestone ? (
                <> for <span className="font-medium text-gray-700">{standupConfig.milestone}</span></>
              ) : (
                <> — all contributions</>
              )}
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all font-medium text-sm flex items-center gap-2 shadow-sm"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {hasOutput ? 'Regenerate with AI' : 'Generate with AI'}
              </>
            )}
          </button>
        </div>

        {/* AI notice */}
        {aiNotice && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {aiNotice}
          </div>
        )}

        {/* Error + inline API key */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm">
            <p className="text-red-700 mb-3">{error}</p>
            {error.toLowerCase().includes('api key') && (
              <div className="space-y-2">
                <p className="text-xs text-red-600">Enter your Claude API key to continue:</p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="flex-1 px-3 py-1.5 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                  />
                  <button
                    onClick={() => {
                      setClaudeApiKey(localApiKey);
                      setError(null);
                      handleGenerate();
                    }}
                    disabled={!localApiKey.trim()}
                    className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Save &amp; Retry
                  </button>
                </div>
                <p className="text-xs text-red-500">
                  Get your key at{' '}
                  <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-red-700">
                    console.anthropic.com
                  </a>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Milestone info — only when configured */}
        {standupConfig.milestone && standupConfig.milestone.trim().length > 0 ? (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 text-xs uppercase tracking-wide font-medium">Milestone</span>
                <p className="text-gray-900 font-medium mt-0.5">
                  {standupConfig.milestone}
                  {standupConfig.epicLink && (
                    <a
                      href={standupConfig.epicLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 hover:underline text-xs"
                    >
                      View epic ↗
                    </a>
                  )}
                </p>
              </div>
              {(standupConfig.originalTargetDate || standupConfig.targetDate) && (
                <div className="grid grid-cols-2 gap-3">
                  {standupConfig.originalTargetDate && (
                    <div>
                      <span className="text-gray-500 text-xs uppercase tracking-wide font-medium">Original Target</span>
                      <p className="text-gray-700 mt-0.5">{standupConfig.originalTargetDate}</p>
                    </div>
                  )}
                  {standupConfig.targetDate && (
                    <div>
                      <span className="text-gray-500 text-xs uppercase tracking-wide font-medium">Current Target</span>
                      <p className={`mt-0.5 font-medium ${
                        standupConfig.originalTargetDate && standupConfig.targetDate > standupConfig.originalTargetDate
                          ? 'text-amber-600'
                          : 'text-gray-700'
                      }`}>
                        {standupConfig.targetDate}
                        {standupConfig.originalTargetDate && standupConfig.targetDate > standupConfig.originalTargetDate && (
                          <span className="ml-1 text-xs font-normal">(slipped)</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            No milestone specified — AI will summarise all contributions grouped by theme.
          </div>
        )}

        {/* Main output area */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Standup Message
            </label>
            {hasOutput && (
              <span className="text-xs text-gray-400">Edit directly before copying</span>
            )}
          </div>
          <textarea
            value={generatedText}
            onChange={(e) => setGeneratedText(e.target.value)}
            rows={18}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-mono leading-relaxed resize-y"
            placeholder={`Click "Generate with AI" to produce your standup message.\n\nThe output will be ready to copy and paste directly into Slack, formatted like:\n\nStatus: 🟢 On Track\n\n*Key updates and Risks:*\n- Merged PR: fix CI sourcemap upload (metamask-mobile)\n- Delivered 8 code reviews (5 approved)\n\n*Next Steps:*\n- Land JS bundle size PR\n- Continue source maps migration\n\n*PRs that need attention from the team:*\n- chore: increase js bundle to 53 — https://github.com/…`}
          />
        </div>

        {/* Actions */}
        {hasOutput && (
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied to clipboard!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy to Clipboard
                </>
              )}
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export .txt
            </button>

            <p className="ml-auto text-xs text-gray-400">
              Paste directly into Slack, Teams, or any chat
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
