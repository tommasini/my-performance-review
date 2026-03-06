'use client';

import { useState } from 'react';
import { FetchedData, UserProfile, StandupConfig, StandupStatus } from '@/app/types';
import ContributionsView from './ContributionsView';

interface StandupReviewProps {
  data: FetchedData;
  profile: UserProfile;
  standupConfig: StandupConfig;
  claudeApiKey: string;
  setClaudeApiKey: (key: string) => void;
}

const STATUS_OPTIONS: { value: StandupStatus; label: string; emoji: string; color: string; bg: string; border: string }[] = [
  {
    value: 'on-track',
    label: 'On Track',
    emoji: '🟢',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-400',
  },
  {
    value: 'at-risk',
    label: 'At Risk',
    emoji: '🟡',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
  },
  {
    value: 'off-track',
    label: 'Off Track',
    emoji: '🔴',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-400',
  },
];

function formatStandupOutput(
  config: StandupConfig,
  status: StandupStatus,
  keyUpdates: string,
  nextSteps: string,
  prsNeedingAttention: string,
): string {
  const statusOption = STATUS_OPTIONS.find(s => s.value === status)!;
  const statusLabel = `${statusOption.emoji} ${statusOption.label}`;
  const hasMilestone = !!(config.milestone && config.milestone.trim().length > 0);

  if (config.customFormat) {
    const milestoneValue = hasMilestone
      ? `${config.milestone}${config.epicLink ? ` ${config.epicLink}` : ''}`
      : '';
    return config.customFormat
      .replace('{milestone}', milestoneValue)
      .replace('{originalTargetDate}', config.originalTargetDate || 'N/A')
      .replace('{targetDate}', config.targetDate || 'N/A')
      .replace('{status}', statusLabel)
      .replace('{keyUpdates}', keyUpdates)
      .replace('{nextSteps}', nextSteps)
      .replace('{prsNeedingAttention}', prsNeedingAttention);
  }

  const lines: string[] = [];

  if (hasMilestone) {
    const milestoneValue = `${config.milestone}${config.epicLink ? ` ${config.epicLink}` : ''}`;
    lines.push(`Milestone (link to epic/bug): ${milestoneValue}`);
    if (config.originalTargetDate) lines.push(`Original Target Date: ${config.originalTargetDate}`);
    if (config.targetDate) lines.push(`Target Date: ${config.targetDate}`);
  }

  lines.push(
    `Status: ${statusLabel}`,
    `Key updates and Risks: ${keyUpdates}`,
    `Next Steps: ${nextSteps}`,
    `PRs that need attention from the team: ${prsNeedingAttention}`,
  );

  return lines.join('\n');
}

export default function StandupReview({
  data,
  profile,
  standupConfig,
  claudeApiKey,
  setClaudeApiKey,
}: StandupReviewProps) {
  const [status, setStatus] = useState<StandupStatus>('on-track');
  const [keyUpdates, setKeyUpdates] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [prsNeedingAttention, setPrsNeedingAttention] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);
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

      // Parse the JSON response from the AI
      try {
        const parsed = JSON.parse(result.answer);
        if (parsed.suggestedStatus) {
          setStatus(parsed.suggestedStatus as StandupStatus);
        }
        setKeyUpdates(parsed.keyUpdates || '');
        setNextSteps(parsed.nextSteps || '');
        setPrsNeedingAttention(parsed.prsNeedingAttention || '');
      } catch {
        // If JSON parse fails, put the raw answer in keyUpdates
        setKeyUpdates(result.answer);
      }

      setGenerated(true);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message || 'An error occurred while generating the standup.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    const output = formatStandupOutput(standupConfig, status, keyUpdates, nextSteps, prsNeedingAttention);
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const output = formatStandupOutput(standupConfig, status, keyUpdates, nextSteps, prsNeedingAttention);
    const filename = `standup-${standupConfig.frequency}-${new Date().toISOString().split('T')[0]}.txt`;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentStatusOption = STATUS_OPTIONS.find(s => s.value === status)!;
  const canGenerate = !isGenerating;

  return (
    <div className="space-y-6">
      <ContributionsView data={data} />

      {/* Standup Builder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Async Standup
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {standupConfig.frequency === 'daily' ? 'Daily' : 'Weekly'} update for{' '}
              <span className="font-medium text-gray-700">{standupConfig.milestone}</span>
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
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
                {generated ? 'Regenerate with AI' : 'Generate with AI'}
              </>
            )}
          </button>
        </div>

        {aiNotice && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {aiNotice}
          </div>
        )}

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

        {/* Milestone info (read-only) — only shown when a milestone was configured */}
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
            No milestone specified — AI summarized all contributions grouped by theme.
          </div>
        )}

        {/* Status Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Status</label>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                  status === opt.value
                    ? `${opt.bg} ${opt.border} ${opt.color}`
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span>{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          {!generated && (
            <p className="mt-2 text-xs text-gray-400">
              AI will suggest a status based on your contributions. You can override it here.
            </p>
          )}
        </div>

        {/* Editable Sections */}
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Key Updates and Risks
            </label>
            <textarea
              value={keyUpdates}
              onChange={(e) => setKeyUpdates(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="- Completed X feature (PR #123 merged)&#10;- Waiting on review for Y (blocking deployment)&#10;- No blockers for today's priorities"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Next Steps
            </label>
            <textarea
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="- Deploy Z to staging&#10;- Address review feedback on PR #456&#10;- Sync with team on integration approach"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              PRs That Need Attention from the Team
            </label>
            <textarea
              value={prsNeedingAttention}
              onChange={(e) => setPrsNeedingAttention(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="- PR #456: Add payment processing — https://github.com/...&#10;- None pending"
            />
          </div>
        </div>
      </div>

      {/* Output Preview + Actions */}
      {(keyUpdates || nextSteps || prsNeedingAttention) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span>{currentStatusOption.emoji}</span>
              Standup Preview
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export .txt
              </button>
            </div>
          </div>

          <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg border border-gray-200 p-4 leading-relaxed">
            {formatStandupOutput(standupConfig, status, keyUpdates, nextSteps, prsNeedingAttention)}
          </pre>
        </div>
      )}
    </div>
  );
}
