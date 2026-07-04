import { useState, useEffect } from 'react';
import { Lock, Unlock, Trophy, Clock, Award, ShieldCheck, RefreshCw } from 'lucide-react';
import type { ElectionDetails } from '../hooks/useContract';

interface ResultsDashboardProps {
  election: ElectionDetails | null;
  onRevealResults: () => Promise<boolean>;
  onDecryptAndFinalize: () => Promise<boolean>;
  loading: boolean;
  error: string;
}

export function ResultsDashboard({
  election,
  onRevealResults,
  onDecryptAndFinalize,
  loading,
  error
}: ResultsDashboardProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [revealStep, setRevealStep] = useState<string>('');

  // Countdown timer effect
  useEffect(() => {
    if (!election) return;
    const { startTime, endTime, status } = election;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      if (status === 'Decrypted') {
        setTimeLeft('Results Decrypted');
        return;
      }

      if (now < startTime) {
        const diff = startTime - now;
        setTimeLeft(`Starts in: ${formatDuration(diff)}`);
      } else if (now < endTime) {
        const diff = endTime - now;
        setTimeLeft(`Active: ${formatDuration(diff)} left`);
      } else {
        setTimeLeft('Voting Ended. Results locked.');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [election]);

  const formatDuration = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  if (!election) {
    return (
      <div className="glass-panel p-8 text-center text-slate-400">
        Select a shielded poll to view results.
      </div>
    );
  }

  const { name, description, totalVotesCast, candidates, results, resultsRevealed, status } = election;

  // Calculate winner if results are available
  let maxVotes = -1;
  let winnerIndex = -1;
  if (resultsRevealed && results.length > 0) {
    results.forEach((v, idx) => {
      if (v > maxVotes) {
        maxVotes = v;
        winnerIndex = idx;
      }
    });
  }

  const handleRevealClick = async () => {
    setRevealStep('1. Submitting reveal request on-chain...');
    const step1 = await onRevealResults();
    if (!step1) {
      setRevealStep('Reveal request failed.');
      return;
    }

    setRevealStep('2. Calling Zama KMS threshold decryption & submitting proof...');
    const step2 = await onDecryptAndFinalize();
    if (step2) {
      setRevealStep('Success! Results revealed.');
    } else {
      setRevealStep('KMS verification failed.');
    }
  };

  return (
    <div className="glass-panel p-6 space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
        <div>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
            Poll Insights
          </span>
          <h2 className="text-xl font-extrabold text-slate-100 font-sans mt-2">{name}</h2>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        </div>

        {/* Timer Box */}
        <div className="flex items-center gap-3 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-2.5 shrink-0">
          <Clock className="h-5 w-5 text-indigo-400 shrink-0" />
          <div>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Timeline status</span>
            <span className="text-xs font-semibold text-slate-200">{timeLeft}</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-slate-950/30 border border-slate-800/60 rounded-xl p-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total ballots cast</span>
          <span className="text-2xl font-black text-slate-100 block mt-1">{totalVotesCast}</span>
        </div>

        <div className="bg-slate-950/30 border border-slate-800/60 rounded-xl p-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tally secrecy</span>
          <span className="text-sm font-semibold flex items-center gap-1.5 mt-2 text-indigo-400">
            {resultsRevealed ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {resultsRevealed ? 'Revealed' : 'FHE Shielded'}
          </span>
        </div>

        <div className="bg-slate-950/30 border border-slate-800/60 rounded-xl p-4 col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Double Voting Prevention</span>
          <span className="text-sm font-semibold flex items-center gap-1.5 mt-2 text-emerald-400">
            <ShieldCheck className="h-4 w-4" /> Active on-chain
          </span>
        </div>
      </div>

      {/* Results View */}
      <div className="space-y-4">
        <h3 className="text-md font-bold text-slate-200">Ballot Tally</h3>

        {resultsRevealed ? (
          // Revealed Results (Graphs/Charts)
          <div className="space-y-4">
            {candidates.map((candidate, idx) => {
              const votes = results[idx] || 0;
              const percentage = totalVotesCast > 0 ? ((votes / totalVotesCast) * 100).toFixed(1) : '0.0';
              const isWinner = idx === winnerIndex;

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border relative overflow-hidden transition-all duration-200 ${
                    isWinner
                      ? 'border-slate-300/30 bg-slate-300/5'
                      : 'border-slate-800/60 bg-slate-950/20'
                  }`}
                >
                  {isWinner && (
                    <div className="absolute top-0 right-0 p-2 text-slate-200 animate-pulse">
                      <Trophy className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {(candidate.symbol.startsWith('http://') || candidate.symbol.startsWith('https://') || candidate.symbol.startsWith('/') || candidate.symbol.startsWith('data:image/')) ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 border border-slate-850 overflow-hidden shrink-0">
                          <img src={candidate.symbol} alt={candidate.name} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-lg border border-slate-850 shrink-0">
                          {candidate.symbol}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                          {candidate.name}
                          {isWinner && (
                            <span className="text-[9px] font-extrabold text-slate-200 bg-slate-200/10 border border-slate-200/20 px-1.5 py-0.5 rounded uppercase">
                              Winner
                            </span>
                          )}
                        </h4>
                        <p className="text-[11px] text-slate-400">{candidate.party}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-slate-100">{votes} votes</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{percentage}%</span>
                    </div>
                  </div>
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isWinner ? 'bg-slate-300' : 'bg-slate-600'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Encrypted / Locked Tally View
          <div className="space-y-3">
            {candidates.map((candidate, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 rounded-xl border border-slate-800/80 bg-slate-950/10"
              >
                <div className="flex items-center gap-3">
                  {(candidate.symbol.startsWith('http://') || candidate.symbol.startsWith('https://') || candidate.symbol.startsWith('/') || candidate.symbol.startsWith('data:image/')) ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 border border-slate-850 overflow-hidden shrink-0">
                      <img src={candidate.symbol} alt={candidate.name} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-lg border border-slate-850 shrink-0">
                      {candidate.symbol}
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">{candidate.name}</h4>
                    <p className="text-[11px] text-slate-400">{candidate.party}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-200 font-semibold bg-slate-300/5 border border-slate-300/10 px-3 py-1.5 rounded-lg">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Confidential Tally</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decrypt Controls (only for Closed status and not yet revealed) */}
      {status === 'Closed' && !resultsRevealed && (
        <div className="border-t border-slate-800/60 pt-6">
          <div className="rounded-xl border border-slate-300/20 bg-slate-300/5 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <h4 className="text-sm font-bold text-slate-200 flex items-center justify-center md:justify-start gap-1.5">
                <Award className="h-4.5 w-4.5 text-slate-200" />
                Decryption Phase Activated
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
                The voting period has ended. Anyone can initiate the threshold KMS decryption callback to reveal the results.
              </p>
            </div>
            
            <button
              onClick={handleRevealClick}
              disabled={loading}
              className="btn-primary shrink-0 w-full md:w-auto"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Decrypt & Reveal Results
            </button>
          </div>

          {revealStep && (
            <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-white leading-relaxed">
              {revealStep}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 font-medium">
          {error}
        </div>
      )}
    </div>
  );
}
