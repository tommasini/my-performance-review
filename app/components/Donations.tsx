'use client';

import { useState } from 'react';

const DONATION_ADDRESSES = {
  ethereum: {
    address: '0x211D13b8F03e5F5D935e42bAf8D4E1724764F5a5',
    symbol: 'Ξ',
    name: 'Ethereum (ETH)',
    color: 'text-blue-500',
  },
  bitcoin: {
    address: 'bc1qdc8ugcaq7mn7l02kswtz78unpzgmw4vl33mr23',
    symbol: '₿',
    name: 'Bitcoin (BTC)',
    color: 'text-orange-500',
  },
  solana: {
    address: 'CdUmvJitNA1MHMM1gpn886s1UijhnUVbWPfkhYpJyKL5',
    symbol: '◎',
    name: 'Solana (SOL)',
    color: 'text-purple-500',
  },
};

interface DonationsProps {
  /** Show a more prominent version after user completes their review */
  showAfterReview?: boolean;
}

export default function Donations({ showAfterReview = false }: DonationsProps) {
  const [copied, setCopied] = useState<string | null>(null);
  // Auto-expand when shown after completing a review
  const [isExpanded, setIsExpanded] = useState(showAfterReview);

  const copyToClipboard = async (address: string, network: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(network);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Contextual messaging based on when component is shown
  const headerContent = showAfterReview ? {
    emoji: '🎉',
    title: 'Did this help with your review?',
    subtitle: 'If you landed that promotion, consider buying me a coffee!',
  } : {
    emoji: '☕',
    title: 'Support This Project',
    subtitle: 'If this helped you, consider buying me a coffee!',
  };

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      showAfterReview 
        ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-green-200 shadow-lg' 
        : 'bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border-amber-200'
    }`}>
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full p-4 flex items-center justify-between transition-colors ${
          showAfterReview ? 'hover:bg-green-100/50' : 'hover:bg-amber-100/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{headerContent.emoji}</span>
          <div className="text-left">
            <h3 className="text-base font-semibold text-gray-900">{headerContent.title}</h3>
            <p className="text-xs text-gray-600">{headerContent.subtitle}</p>
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className={`px-4 pb-4 border-t ${showAfterReview ? 'border-green-200/50' : 'border-amber-200/50'}`}>
          {/* Fiat donation options */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href="https://ko-fi.com/tommasini"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FF5E5B] text-white rounded-lg hover:bg-[#ff4744] transition-colors font-medium text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
              </svg>
              Buy me a coffee
            </a>
            <a
              href="https://github.com/sponsors/tommasini"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#24292e] text-white rounded-lg hover:bg-[#1a1e22] transition-colors font-medium text-sm"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Sponsor
            </a>
          </div>

          {/* Crypto donations */}
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
              Or donate crypto:
            </p>
            
            <div className="space-y-2">
              {Object.entries(DONATION_ADDRESSES).map(([network, { address, symbol, name, color }]) => (
                <div 
                  key={network} 
                  className={`flex items-center gap-3 p-2 rounded-lg border ${
                    showAfterReview ? 'bg-white/60 border-green-100' : 'bg-white/60 border-amber-100'
                  }`}
                >
                  <div className={`w-8 h-8 flex items-center justify-center text-xl font-bold ${color}`}>
                    {symbol}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">{name}</p>
                    <p className="text-xs font-mono truncate text-gray-700">{address}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(address, network)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                      copied === network 
                        ? 'bg-green-100 text-green-700' 
                        : showAfterReview
                          ? 'bg-green-100 hover:bg-green-200 text-green-800'
                          : 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                    }`}
                  >
                    {copied === network ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 mt-4 text-center">
            Your support helps keep this tool free for everyone 💛
          </p>
        </div>
      )}
    </div>
  );
}
