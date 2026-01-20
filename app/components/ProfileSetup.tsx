'use client';

import { UserProfile, DataSourceConfig, DataSourceType } from '@/app/types';
import { format, startOfYear } from 'date-fns';
import { useEffect, useState } from 'react';

interface ProfileSetupProps {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  dataSources: DataSourceConfig[];
  setDataSources: (sources: DataSourceConfig[]) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
}

interface DataSourceInfo {
  name: string;
  icon: string;
  placeholder: { org: string; user: string; token: string };
  requiresToken: boolean;
  requiresBaseUrl: boolean;
  baseUrlPlaceholder?: string;
  baseUrlLabel?: string;
  helpText?: string;
  signupUrl: string;
  securityTip: {
    title: string;
    scopes: string[];
    note?: string;
  };
}

const DATA_SOURCE_INFO: Record<DataSourceType, DataSourceInfo> = {
  github: {
    name: 'GitHub',
    icon: '🐙',
    placeholder: { org: 'your-org', user: 'your-username', token: 'ghp_...' },
    requiresToken: false,
    requiresBaseUrl: false,
    helpText: 'Token increases rate limits. Create at github.com/settings/tokens',
    signupUrl: 'https://github.com/settings/tokens',
    securityTip: {
      title: 'Recommended read-only scopes:',
      scopes: ['read:user', 'repo (read-only)', 'read:org'],
      note: 'For Fine-grained tokens: select "Read-only" for Repository permissions',
    },
  },
  gitlab: {
    name: 'GitLab',
    icon: '🦊',
    placeholder: { org: 'your-group', user: 'your-username', token: 'glpat-...' },
    requiresToken: true,
    requiresBaseUrl: false,
    baseUrlPlaceholder: 'https://gitlab.com',
    baseUrlLabel: 'GitLab URL (for self-hosted)',
    helpText: 'Create Personal Access Token at gitlab.com/-/user_settings/personal_access_tokens',
    signupUrl: 'https://gitlab.com/-/user_settings/personal_access_tokens',
    securityTip: {
      title: 'Recommended read-only scopes:',
      scopes: ['read_api', 'read_user', 'read_repository'],
      note: 'Never grant write or admin permissions',
    },
  },
  bitbucket: {
    name: 'Bitbucket',
    icon: '🪣',
    placeholder: { org: 'your-workspace', user: 'your-username', token: 'app-password' },
    requiresToken: true,
    requiresBaseUrl: false,
    helpText: 'Create App Password at bitbucket.org/account/settings/app-passwords',
    signupUrl: 'https://bitbucket.org/account/settings/app-passwords',
    securityTip: {
      title: 'Recommended read-only permissions:',
      scopes: ['Account: Read', 'Repositories: Read', 'Pull requests: Read'],
      note: 'Only select Read permissions, never Write or Admin',
    },
  },
  jira: {
    name: 'Jira',
    icon: '📋',
    placeholder: { org: 'PROJECT-KEY', user: 'your@email.com', token: 'api-token' },
    requiresToken: true,
    requiresBaseUrl: true,
    baseUrlPlaceholder: 'https://yourcompany.atlassian.net',
    baseUrlLabel: 'Jira Instance URL *',
    helpText: 'Create API token at id.atlassian.com/manage-profile/security/api-tokens',
    signupUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    securityTip: {
      title: 'API Token Security:',
      scopes: ['Inherits your Jira account permissions'],
      note: 'API tokens use your existing permissions. We only read issue data.',
    },
  },
};

// Tooltip component for security information
function SecurityTooltip({ info, isVisible, onClose }: { 
  info: DataSourceInfo['securityTip']; 
  isVisible: boolean;
  onClose: () => void;
}) {
  if (!isVisible) return null;
  
  return (
    <div className="absolute z-10 bottom-full left-0 mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
      <div className="flex items-start justify-between mb-2">
        <span className="font-semibold flex items-center gap-1">
          <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {info.title}
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ul className="space-y-1 mb-2">
        {info.scopes.map((scope, idx) => (
          <li key={idx} className="flex items-center gap-1">
            <span className="text-green-400">•</span>
            <code className="bg-gray-800 px-1 rounded">{scope}</code>
          </li>
        ))}
      </ul>
      {info.note && (
        <p className="text-gray-300 border-t border-gray-700 pt-2 mt-2">
          {info.note}
        </p>
      )}
      <div className="absolute bottom-0 left-4 transform translate-y-full">
        <div className="border-8 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
}

export default function ProfileSetup({
  profile,
  setProfile,
  dataSources,
  setDataSources,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: ProfileSetupProps) {
  // Track which tooltip is visible
  const [visibleTooltip, setVisibleTooltip] = useState<DataSourceType | null>(null);

  // Initialize dates on mount
  useEffect(() => {
    if (!startDate && !endDate) {
      const now = new Date();
      setStartDate(format(startOfYear(now), 'yyyy-MM-dd'));
      setEndDate(format(now, 'yyyy-MM-dd'));
    }
  }, [startDate, endDate, setStartDate, setEndDate]);

  const updateProfile = (field: keyof UserProfile, value: string | number) => {
    setProfile({ ...profile, [field]: value });
  };

  const toggleDataSource = (type: DataSourceType) => {
    const existingIndex = dataSources.findIndex(ds => ds.type === type);
    
    if (existingIndex >= 0) {
      const updated = [...dataSources];
      updated[existingIndex] = { ...updated[existingIndex], enabled: !updated[existingIndex].enabled };
      setDataSources(updated);
    } else {
      setDataSources([...dataSources, {
        type,
        enabled: true,
        username: '',
        organization: '',
        baseUrl: type === 'jira' ? '' : undefined,
      }]);
    }
  };

  const updateDataSource = (type: DataSourceType, field: keyof DataSourceConfig, value: string | boolean) => {
    const updated = dataSources.map(ds => 
      ds.type === type ? { ...ds, [field]: value } : ds
    );
    setDataSources(updated);
  };

  const getDataSource = (type: DataSourceType) => 
    dataSources.find(ds => ds.type === type);

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-2xl">👤</span>
          Your Profile
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Position *
            </label>
            <input
              type="text"
              value={profile.currentPosition}
              onChange={(e) => updateProfile('currentPosition', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Senior Software Engineer"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Position
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <input
              type="text"
              value={profile.targetPosition}
              onChange={(e) => updateProfile('targetPosition', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Staff Engineer"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              value={profile.companyName}
              onChange={(e) => updateProfile('companyName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your Company"
            />
          </div>
        </div>
      </div>

      {/* Date Range Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-2xl">📅</span>
          Review Period
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Data Sources Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <span className="text-2xl">🔗</span>
          Data Sources
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Connect your work platforms to fetch your contributions automatically. You can enable multiple sources.
        </p>
        
        <div className="space-y-4">
          {(Object.keys(DATA_SOURCE_INFO) as DataSourceType[]).map((type) => {
            const info = DATA_SOURCE_INFO[type];
            const source = getDataSource(type);
            const isEnabled = source?.enabled ?? false;
            
            return (
              <div 
                key={type}
                className={`border rounded-lg transition-all ${
                  isEnabled 
                    ? 'border-blue-300 bg-blue-50/30' 
                    : 'border-gray-200 bg-gray-50/30 hover:border-gray-300'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <span className="font-medium text-gray-900">{info.name}</span>
                        {info.requiresToken && (
                          <span className="ml-2 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                            Requires token
                          </span>
                        )}
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleDataSource(type)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  
                  {isEnabled && (
                    <div className="space-y-3 mt-3 pt-3 border-t border-gray-200">
                      {/* Base URL for Jira/GitLab self-hosted */}
                      {info.requiresBaseUrl && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {info.baseUrlLabel}
                          </label>
                          <input
                            type="url"
                            value={source?.baseUrl || ''}
                            onChange={(e) => updateDataSource(type, 'baseUrl', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={info.baseUrlPlaceholder}
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {type === 'jira' ? 'Project Key' : type === 'bitbucket' ? 'Workspace' : 'Organization / Group'}
                            {type !== 'jira' && <span className="text-gray-400 font-normal ml-1">(optional)</span>}
                          </label>
                          <input
                            type="text"
                            value={source?.organization || ''}
                            onChange={(e) => updateDataSource(type, 'organization', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={info.placeholder.org}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {type === 'jira' ? 'Email Address' : 'Username'} *
                          </label>
                          <input
                            type={type === 'jira' ? 'email' : 'text'}
                            value={source?.username || ''}
                            onChange={(e) => updateDataSource(type, 'username', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={info.placeholder.user}
                          />
                        </div>
                        <div className="relative">
                          <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                            {type === 'bitbucket' ? 'App Password' : 'Access Token'}
                            {!info.requiresToken && <span className="text-gray-400 font-normal">(optional)</span>}
                            {info.requiresToken && ' *'}
                            {/* Security info tooltip trigger */}
                            <button
                              type="button"
                              onClick={() => setVisibleTooltip(visibleTooltip === type ? null : type)}
                              className="ml-1 text-blue-500 hover:text-blue-700 focus:outline-none"
                              title="Security recommendations"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </button>
                          </label>
                          {/* Security tooltip */}
                          <SecurityTooltip
                            info={info.securityTip}
                            isVisible={visibleTooltip === type}
                            onClose={() => setVisibleTooltip(null)}
                          />
                          <input
                            type="password"
                            value={source?.token || ''}
                            onChange={(e) => updateDataSource(type, 'token', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={info.placeholder.token}
                          />
                        </div>
                      </div>

                      {info.helpText && (
                        <p className="text-xs text-gray-500 mt-2">
                          💡 {info.helpText}
                          {' '}
                          <a
                            href={info.signupUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Get token →
                          </a>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start gap-2">
            <span className="text-lg">🔒</span>
            <div className="text-xs text-gray-600">
              <p className="font-medium text-gray-700">Your tokens are secure</p>
              <p>Tokens are processed server-side only and are never stored. They&apos;re used solely to fetch your contributions.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
