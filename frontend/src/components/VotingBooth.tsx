import { useState, useEffect } from 'react';
import {
  Shield, ShieldCheck, Lock, Unlock, Key, CheckCircle, Clock,
  EyeOff, Vote, Trophy, Award, RefreshCw, AlertTriangle,
  Users, BarChart3
} from 'lucide-react';
import type { ElectionDetails } from '../hooks/useContract';

interface VotingBoothProps {
  election: ElectionDetails | null;
  isRegistered: boolean;
  isVoterPassMinted: boolean;
  isFheReady: boolean;
  onCastVote: (choiceIndex: number) => Promise<boolean>;
  loading: boolean;
  onRevealResults: () => Promise<boolean>;
  onDecryptAndFinalize: () => Promise<boolean>;
  error: string;
}

export function VotingBooth({
  election,
  isRegistered,
  isVoterPassMinted,
  isFheReady,
  onCastVote,
  loading,
  onRevealResults,
  onDecryptAndFinalize,
  error
}: VotingBoothProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [txSuccess, setTxSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [revealStep, setRevealStep] = useState<string>('');

  // Countdown timer
  useEffect(() => {
    if (!election) return;
    const { startTime, endTime, resultsRevealed } = election;

    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000);
      if (resultsRevealed) {
        setTimeLeft('Results Decrypted');
        return;
      }
      if (now < startTime) {
        setTimeLeft(`Starts in: ${formatDuration(startTime - now)}`);
      } else if (now < endTime) {
        setTimeLeft(`Active: ${formatDuration(endTime - now)} left`);
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
      <div className="bg-[#030305] border border-slate-900 rounded-2xl p-12 text-center text-slate-500 font-medium">
        <Vote className="h-8 w-8 mx-auto mb-3 text-slate-700" />
        Select an active shielded poll to cast your vote.
      </div>
    );
  }

  const { status, candidates, isVoted, totalVotesCast, results, resultsRevealed } = election;

  // Winner calculation
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

  const handleVoteSubmit = async () => {
    if (selectedCandidate === null) return;
    setTxSuccess(false);
    setStatusMessage('1. Encrypting ballot choice client-side...');
    await new Promise(resolve => setTimeout(resolve, 800));
    setStatusMessage('2. Signing and broadcasting FHE-shielded ballot...');
    const success = await onCastVote(selectedCandidate);
    if (success) {
      setTxSuccess(true);
      setSelectedCandidate(null);
      setStatusMessage('Shielded Ballot Submitted! Your choice remains completely confidential.');
    } else {
      setStatusMessage('Voting failed. See error console.');
    }
  };

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

  const isVotingDisabled =
    loading || isVoted || status !== 'Voting' || !isRegistered ||
    !isVoterPassMinted || !isFheReady || selectedCandidate === null;

  const candidateColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  const isImageUrl = (sym: string) =>
    sym.startsWith('http://') || sym.startsWith('https://') || sym.startsWith('/') || sym.startsWith('data:image/');

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* ═══════════════════════════════════════════ */}
      {/* MAIN CONTENT (LEFT) — Ballot Box & Results */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex-1 space-y-6">
        
        {/* Status Alerts */}
        <div className="space-y-3">
          {status !== 'Voting' && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-sm text-amber-400 font-medium">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Voting is not active for this poll. Status: {status}
            </div>
          )}

          {!isRegistered && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-sm text-rose-400 font-medium">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              You do not have a valid FHE Pass. Register your wallet to enable voting.
            </div>
          )}

          {isRegistered && !isVoterPassMinted && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-[#FFD208]/20 bg-[#FFD208]/10 text-sm text-[#FFD208] font-medium">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Mint your soulbound Voter Pass NFT in the "Claim FHE Pass" tab to authorize voting.
            </div>
          )}

          {isVoted && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-slate-200">Ballot Cast Successfully</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Your double-vote protection has been activated.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* The Ballot Container */}
        <div className="bg-[#030305] border border-slate-900 rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#FFD208]/5 blur-[100px] pointer-events-none" />
          
          <div className="border-b border-slate-800/60 pb-5">
            <h3 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#FFD208]/10 border border-[#FFD208]/20 flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-[#FFD208]" />
              </div>
              Shielded Ballot Box
            </h3>
            <p className="text-sm text-slate-400 mt-2">
              Select one candidate. Your choice is fully encrypted with FHE before leaving your browser.
            </p>
          </div>

          {resultsRevealed ? (
            /* ─── Revealed Results View ─── */
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Final Decrypted Tally
              </h4>
              <div className="space-y-3">
                {candidates.map((candidate, idx) => {
                  const votes = results[idx] || 0;
                  const percentage = totalVotesCast > 0 ? ((votes / totalVotesCast) * 100).toFixed(1) : '0.0';
                  const isWinner = idx === winnerIndex;
                  return (
                    <div
                      key={idx}
                      className={`p-5 rounded-2xl border relative overflow-hidden transition-all ${
                        isWinner
                          ? 'border-[#FFD208]/30 bg-[#FFD208]/5'
                          : 'border-slate-800/60 bg-slate-950/20'
                      }`}
                    >
                      {isWinner && (
                        <div className="absolute top-3 right-3">
                          <Trophy className="h-6 w-6 text-[#FFD208] animate-pulse" />
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          {isImageUrl(candidate.symbol) ? (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden border-2" style={{ borderColor: candidateColors[idx % candidateColors.length] + '40' }}>
                              <img src={candidate.symbol} alt={candidate.name} className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold border-2" style={{ borderColor: candidateColors[idx % candidateColors.length] + '40', backgroundColor: candidateColors[idx % candidateColors.length] + '15', color: candidateColors[idx % candidateColors.length] }}>
                              {candidate.symbol || candidate.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <h4 className="text-base font-bold text-slate-200 flex items-center gap-2">
                              {candidate.name}
                              {isWinner && (
                                <span className="text-[10px] font-extrabold text-[#FFD208] bg-[#FFD208]/10 border border-[#FFD208]/20 px-2 py-0.5 rounded uppercase">
                                  Winner
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">{candidate.party}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-slate-100 block">{votes} votes</span>
                          <span className="text-xs font-semibold text-slate-500">{percentage}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-800/60 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: isWinner ? '#FFD208' : candidateColors[idx % candidateColors.length]
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ─── Voting Candidate List ─── */
            <div className="space-y-3">
              {candidates.map((candidate, idx) => (
                <label
                  key={idx}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 cursor-pointer group ${
                    isVoted || status !== 'Voting' || !isRegistered
                      ? 'opacity-60 cursor-not-allowed border-slate-800/60 bg-slate-900/10'
                      : selectedCandidate === idx
                      ? 'border-[#FFD208]/60 bg-[#FFD208]/10 ring-1 ring-[#FFD208]/30 shadow-[0_0_20px_rgba(255,210,8,0.05)]'
                      : 'border-slate-800/80 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center h-5 w-5 shrink-0">
                      <input
                        type="radio"
                        name="candidate-selection"
                        checked={selectedCandidate === idx}
                        onChange={() => setSelectedCandidate(idx)}
                        disabled={isVoted || status !== 'Voting' || !isRegistered}
                        className="h-5 w-5 text-[#FFD208] focus:ring-[#FFD208] border-slate-700 bg-slate-900 accent-[#FFD208] cursor-pointer"
                      />
                    </div>
                    {isImageUrl(candidate.symbol) ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden border-2 transition-transform group-hover:scale-105" style={{ borderColor: candidateColors[idx % candidateColors.length] + '40' }}>
                        <img src={candidate.symbol} alt={candidate.name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold border-2 transition-transform group-hover:scale-105" style={{ borderColor: candidateColors[idx % candidateColors.length] + '40', backgroundColor: candidateColors[idx % candidateColors.length] + '15', color: candidateColors[idx % candidateColors.length] }}>
                        {candidate.symbol || candidate.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 className="text-base font-bold text-slate-200">{candidate.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{candidate.party}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#FFD208] uppercase bg-[#FFD208]/10 border border-[#FFD208]/20 px-3 py-1.5 rounded-lg tracking-wider">
                    Encrypted
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Action Section */}
          {!resultsRevealed && (
            <div className="pt-6 border-t border-slate-800/60 space-y-4">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Lock className="h-3.5 w-3.5" />
                Your vote is encrypted before leaving your device and cannot be changed.
              </div>

              {statusMessage && (
                <div className={`p-4 rounded-xl border text-sm font-mono text-center leading-relaxed shadow-lg ${
                  txSuccess
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-700 bg-slate-900/60 text-slate-300'
                }`}>
                  {statusMessage}
                </div>
              )}

              <button
                onClick={handleVoteSubmit}
                disabled={isVotingDisabled}
                className="w-full bg-[#FFD208] text-black font-extrabold text-sm uppercase tracking-wider px-8 py-4 rounded-xl hover:bg-yellow-400 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-[0_0_20px_rgba(255,210,8,0.3)] disabled:hover:shadow-none"
              >
                {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
                Cast Shielded Ballot
              </button>

              {!isFheReady && isRegistered && status === 'Voting' && (
                <p className="text-xs text-center font-bold text-amber-400 animate-pulse mt-2">
                  Initializing FHE WebAssembly. Please wait...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* SIDEBAR (RIGHT) — Insights, Privacy & Decrypt */}
      {/* ═══════════════════════════════════════════ */}
      <div className="w-full lg:w-[360px] shrink-0 space-y-6">
        
        {/* Timeline Status */}
        <div className="bg-[#030305] border border-slate-900 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-[#FFD208]/10 blur-[50px] pointer-events-none" />
          <span className="text-[10px] font-black text-[#FFD208] uppercase tracking-widest flex items-center gap-2 mb-2 relative">
            <Clock className="h-4 w-4" />
            Timeline Status
          </span>
          <p className="text-xl font-bold text-slate-100 relative">{timeLeft || 'Loading...'}</p>
        </div>

        {/* Poll Insights Card */}
        <div className="bg-[#030305] border border-slate-900 rounded-2xl p-6 space-y-5">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800/60 pb-3">
            <BarChart3 className="h-4 w-4" />
            Poll Insights
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Total Ballots Cast</span>
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                <Users className="h-3.5 w-3.5 text-[#FFD208]" />
                <span className="text-sm font-bold text-slate-200">{totalVotesCast}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Tally Secrecy</span>
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                {resultsRevealed ? <Unlock className="h-3.5 w-3.5 text-emerald-400" /> : <Lock className="h-3.5 w-3.5 text-[#FFD208]" />}
                <span className="text-xs font-bold text-slate-200">{resultsRevealed ? 'Revealed' : 'FHE Shielded'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Double-Voting</span>
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-400">Protected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cryptographic Guarantees Card */}
        <div className="bg-[#030305] border border-slate-900 rounded-2xl p-6 space-y-5">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800/60 pb-3">
            <ShieldCheck className="h-4 w-4" />
            Security Guarantees
          </h4>
          
          <div className="space-y-5">
            <div className="flex gap-3 items-start">
              <div className="h-8 w-8 rounded-xl bg-[#FFD208]/10 border border-[#FFD208]/20 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-[#FFD208]" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 block">Zero-Knowledge Shielding</span>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Your choice is encrypted locally in browser.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="h-8 w-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Key className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 block">KMS Threshold Decryption</span>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Results require Zama network consensus to unlock.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <EyeOff className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-200 block">Total Anonymity</span>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  No one can mathematically link your wallet to your vote.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Decrypt & Reveal Results (Only when Closed) */}
        {status === 'Closed' && !resultsRevealed && (
          <div className="bg-[#0a0a12] border border-[#FFD208]/30 rounded-2xl p-6 space-y-4 relative overflow-hidden shadow-[0_0_30px_rgba(255,210,8,0.05)]">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#FFD208]/10 blur-[60px] pointer-events-none" />
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 relative">
              <Award className="h-5 w-5 text-[#FFD208]" />
              Decrypt & Reveal Results
            </h4>
            <p className="text-[11px] text-slate-400 leading-relaxed relative">
              The voting period has ended. The threshold KMS decryption callback can now be initiated to reveal the final tally.
            </p>

            <button
              onClick={handleRevealClick}
              disabled={loading}
              className="w-full bg-[#FFD208] text-black font-extrabold text-xs uppercase tracking-wider px-5 py-3 rounded-xl hover:bg-yellow-400 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed relative"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Execute Decryption
            </button>

            {revealStep && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-mono text-yellow-300 leading-relaxed relative">
                {revealStep}
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-sm text-rose-400 font-medium">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
