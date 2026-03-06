'use client';

import { useState, useEffect } from 'react';
import type { StandupConfig, StandupFrequency } from '@/app/types';

interface StandupConfigProps {
  standupConfig: StandupConfig;
  setStandupConfig: (config: StandupConfig) => void;
  claudeApiKey: string;
  setClaudeApiKey: (key: string) => void;
}

interface ServerAIStatus {
  hasAnyKey: boolean;
  isLoading: boolean;
}

const DEFAULT_STANDUP_FORMAT = `Milestone (link to epic/bug): {milestone}
Original Target Date: {originalTargetDate}
Target Date: {targetDate}
Status: :large_green_circle: On Track | :large_yellow_circle: At Risk | :red_circle: Off Track
Key updates and Risks: [List any challenges, dependencies, PRs not reviewed or unplanned work stopping you from jeopardizing the target date]
Next Steps: [List your main priorities for today.]
PRs that need attention from the team: [List of PRs]`;

export default function StandupConfig({
  standupConfig,
  setStandupConfig,
  claudeApiKey,
  setClaudeApiKey,
}: StandupConfigProps) {
  const [useCustomFormat, setUseCustomFormat] = useState(!!standupConfig.customFormat);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerAIStatus>({ hasAnyKey: true, isLoading: true });

  useEffect(() => {
    const checkServerKeys = async () => {
      try {
        const response = await fetch('/api/ai');
        if (response.ok) {
          const data = await response.json();
          const hasAnyKey = data.hasClaudeKey || data.hasOpenAIKey || data.hasDeepSeekKey;
          setServerStatus({ hasAnyKey, isLoading: false });
          if (!hasAnyKey) setShowApiKeyInput(true);
        } else {
          setServerStatus({ hasAnyKey: false, isLoading: false });
          setShowApiKeyInput(true);
        }
      } catch {
        setServerStatus({ hasAnyKey: false, isLoading: false });
        setShowApiKeyInput(true);
      }
    };
    checkServerKeys();
  }, []);

  const update = (field: keyof StandupConfig, value: string) => {
    setStandupConfig({ ...standupConfig, [field]: value });
  };

  const handleFrequencyChange = (freq: StandupFrequency) => {
    setStandupConfig({ ...standupConfig, frequency: freq });
  };

  const handleFormatToggle = (custom: boolean) => {
    setUseCustomFormat(custom);
    if (!custom) {
      setStandupConfig({ ...standupConfig, customFormat: undefined });
    }
  };

  return (
    <div className="space-y-6">
      {/* Frequency */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <span className="text-2xl">📋</span>
          Standup Configuration
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Configure your standup context. The AI will use your contribution data to generate a filled standup update.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">Standup Frequency</label>
          <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            {(['daily', 'weekly'] as StandupFrequency[]).map((freq) => (
              <button
                key={freq}
                onClick={() => handleFrequencyChange(freq)}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-all capitalize ${
                  standupConfig.frequency === freq
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {freq === 'daily' ? 'Daily' : 'Weekly'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {standupConfig.frequency === 'daily'
              ? 'Concise daily update — focused on yesterday\'s progress and today\'s priorities.'
              : 'Weekly summary — broader view of progress, blockers, and upcoming priorities.'}
          </p>
        </div>
      </div>

      {/* Milestone Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          Milestone Context
          <span className="text-sm font-normal text-gray-400">(optional)</span>
        </h2>
        <p className="text-sm text-gray-600 mb-5">
          Optionally scope this standup to a specific milestone or feature. If left blank, the AI will analyze all your contributions and group them by inferred theme.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Milestone / Feature Name
            </label>
            <input
              type="text"
              value={standupConfig.milestone || ''}
              onChange={(e) => update('milestone', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="e.g. User Authentication v2, Payment Gateway Integration"
            />
          </div>

          {standupConfig.milestone && standupConfig.milestone.length > 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Epic / Bug Link
                  <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={standupConfig.epicLink || ''}
                  onChange={(e) => update('epicLink', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="https://jira.company.com/browse/PROJ-123"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Original Target Date
                    <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={standupConfig.originalTargetDate || ''}
                    onChange={(e) => update('originalTargetDate', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Target Date
                    <span className="ml-1 text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date"
                    value={standupConfig.targetDate || ''}
                    onChange={(e) => update('targetDate', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  {standupConfig.originalTargetDate && standupConfig.targetDate &&
                   standupConfig.targetDate > standupConfig.originalTargetDate && (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Target date has slipped — AI will note this as a risk factor.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {(!standupConfig.milestone || standupConfig.milestone.length === 0) && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <svg className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-blue-700">
                No milestone set — the AI will cover all your contributions and group them by inferred theme or area of work.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Standup Format */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <span className="text-2xl">📄</span>
          Output Format
        </h2>
        <p className="text-sm text-gray-600 mb-5">
          Choose the standup format. The default follows a standard async standup structure, or paste your team&apos;s custom template.
        </p>

        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50 mb-5">
          <button
            onClick={() => handleFormatToggle(false)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              !useCustomFormat ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Default Template
          </button>
          <button
            onClick={() => handleFormatToggle(true)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
              useCustomFormat ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Custom Format
          </button>
        </div>

        {!useCustomFormat ? (
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Preview — Default Template</p>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
              {DEFAULT_STANDUP_FORMAT
                .replace('{milestone}', standupConfig.milestone || '[AI will group by theme]')
                .replace('{originalTargetDate}', standupConfig.originalTargetDate || 'YYYY-MM-DD')
                .replace('{targetDate}', standupConfig.targetDate || 'YYYY-MM-DD')}
            </pre>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Custom Template
            </label>
            <textarea
              value={standupConfig.customFormat || ''}
              onChange={(e) => update('customFormat', e.target.value)}
              rows={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              placeholder={`Paste your team's standup template here. For example:\n\nMilestone (link to epic/bug):\nOriginal Target Date: YYYY-MM-DD\nTarget Date: YYYY-MM-DD\nStatus: On Track | At Risk | Off Track\nKey updates and Risks:\nNext Steps:\nPRs that need attention from the team:`}
            />
            <p className="mt-2 text-xs text-gray-500">
              The AI will use this template as the output format and fill in each section based on your contributions.
            </p>
          </div>
        )}
      </div>

      {/* API Key */}
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
            {' '}- Limited free generations provided. Add your own Claude API key for unlimited access.
          </p>
        ) : (
          <div className="mb-4 p-3 bg-amber-100/50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div className="text-sm text-amber-800">
                <p className="font-medium">This instance requires your own API key</p>
                <p className="text-amber-700 mt-1">No server AI keys are configured. Please provide your own Claude API key.</p>
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
              <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">
                console.anthropic.com
              </a>
            </p>
            {claudeApiKey && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>API key provided — unlimited access enabled</span>
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
