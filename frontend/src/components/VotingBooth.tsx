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
    <div className="grid grid-cols-[240px_1fr_280px] gap-5">

      {/* ═══════════════════════════════════════════ */}
      {/* LEFT SIDEBAR — Privacy Protections         */}
      {/* ═══════════════════════════════════════════ */}
      <div className="space-y-5">
        <div className="bg-[#030305] border border-slate-900 rounded-2xl p-5 space-y-5">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-[#FFD208]" />
            Your Privacy is Protected
          </span>

          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <div className="h-8 w-8 rounded-lg bg-[#FFD208]/10 border border-[#FFD208]/20 flex items-center justify-center shrink-0">
                <Shield className="h-4 w-4 text-[#FFD208]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">Zero-Knowledge Proofs</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Your vote is encrypted locally.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">On-Chain Security</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">Results are tamper-proof.</p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <EyeOff className="h-4 w-4 text-violet-400" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-200">You Stay Anonymous</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">No one can link you to your vote.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* CENTER COLUMN — Ballot Box + Poll Insights  */}
      {/* ═══════════════════════════════════════════ */}
      <div className="space-y-5">

        {/* Shielded Ballot Box */}
        <div className="bg-[#030305] border border-slate-900 rounded-2xl p-5 sm:p-6 space-y-4 relative overflow-hidden">
          {/* Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-yellow-500/5 blur-[80px] pointer-events-none" />

          <div className="flex items-center gap-2.5 relative">
            <div className="h-9 w-9 rounded-xl bg-[#FFD208]/10 border border-[#FFD208]/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-[#FFD208]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-100">Shielded Ballot Box</h3>
              <p className="text-[10px] text-slate-500">
                Select one candidate. Your choice is fully encrypted with FHE before leaving your browser.
              </p>
            </div>
          </div>

          {/* Status Banners */}
          {status !== 'Voting' && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs text-amber-400 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Voting is not active for this poll. Status: {status}
            </div>
          )}

          {!isRegistered && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              You do not have a valid FHE Pass. Register your wallet to enable voting.
            </div>
          )}

          {isRegistered && !isVoterPassMinted && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-xs text-yellow-400 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Mint your soulbound Voter Pass NFT in the "Claim FHE Pass" tab to authorize voting.
            </div>
          )}

          {isVoted && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-200">Ballot Cast Successfully</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  You have already submitted a ballot for this poll. Your double-vote protection has been activated.
                </p>
              </div>
            </div>
          )}

          {/* Candidate List */}
          {resultsRevealed ? (
            /* ─── Revealed Results View ─── */
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> Decrypted Results
              </h4>
              {candidates.map((candidate, idx) => {
                const votes = results[idx] || 0;
                const percentage = totalVotesCast > 0 ? ((votes / totalVotesCast) * 100).toFixed(1) : '0.0';
                const isWinner = idx === winnerIndex;
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border relative overflow-hidden transition-all ${
                      isWinner
                        ? 'border-[#FFD208]/30 bg-[#FFD208]/5'
                        : 'border-slate-800/60 bg-slate-950/20'
                    }`}
                  >
                    {isWinner && (
                      <div className="absolute top-2 right-2">
                        <Trophy className="h-5 w-5 text-[#FFD208] animate-pulse" />
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-3">
                        {isImageUrl(candidate.symbol) ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden border-2" style={{ borderColor: candidateColors[idx % candidateColors.length] + '40' }}>
                            <img src={candidate.symbol} alt={candidate.name} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold border-2" style={{ borderColor: candidateColors[idx % candidateColors.length] + '40', backgroundColor: candidateColors[idx % candidateColors.length] + '15', color: candidateColors[idx % candidateColors.length] }}>
                            {candidate.symbol || candidate.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                            {candidate.name}
                            {isWinner && (
                              <span className="text-[8px] font-extrabold text-[#FFD208] bg-[#FFD208]/10 border border-[#FFD208]/20 px-1.5 py-0.5 rounded uppercase">
                                Winner
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-slate-500">{candidate.party}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-100">{votes} votes</span>
                        <span className="text-[10px] text-slate-500 block">{percentage}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800/60 h-1.5 rounded-full overflow-hidden">
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
          ) : (
            /* ─── Voting Candidate List ─── */
            <div className="space-y-2.5">
              {candidates.map((candidate, idx) => (
                <label
                  key={idx}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isVoted || status !== 'Voting' || !isRegistered
                      ? 'opacity-60 cursor-not-allowed border-slate-800/60 bg-slate-900/10'
                      : selectedCandidate === idx
                      ? 'border-[#FFD208]/60 bg-[#FFD208]/5 ring-1 ring-[#FFD208]/20'
                      : 'border-slate-800/60 hover:border-slate-700 bg-slate-950/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="candidate-selection"
                      checked={selectedCandidate === idx}
                      onChange={() => setSelectedCandidate(idx)}
                      disabled={isVoted || status !== 'Voting' || !isRegistered}
                      className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-slate-700 bg-slate-900 accent-[#FFD208]"
                    />
                    {isImageUrl(candidate.symbol) ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden border-2" style={{ borderColor: candidateColors[idx % candidateColors.length] + '40' }}>
                        <img src={candidate.symbol} alt={candidate.name} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold border-2" style={{ borderColor: candidateColors[idx % candidateColors.length] + '40', backgroundColor: candidateColors[idx % candidateColors.length] + '15', color: candidateColors[idx % candidateColors.length] }}>
                        {candidate.symbol || candidate.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">{candidate.name}</h4>
                      <p className="text-[10px] text-slate-500">{candidate.party}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-[#FFD208] uppercase bg-[#FFD208]/10 border border-[#FFD208]/20 px-2.5 py-1 rounded-lg tracking-wider">
                    Encrypted
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Bottom note + Cast button */}
          {!resultsRevealed && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <Lock className="h-3 w-3" />
                Your vote is encrypted and cannot be changed.
              </div>

              {statusMessage && (
                <div className={`p-3 rounded-lg border text-xs font-mono leading-relaxed ${
                  txSuccess
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-800 bg-slate-950/40 text-slate-300'
                }`}>
                  {statusMessage}
                </div>
              )}

              <button
                onClick={handleVoteSubmit}
                disabled={isVotingDisabled}
                className="w-full bg-[#FFD208] text-black font-extrabold text-xs uppercase tracking-wider px-6 py-3 rounded-xl hover:bg-yellow-400 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#FFD208]"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                Cast Shielded Ballot
              </button>

              {!isFheReady && isRegistered && status === 'Voting' && (
                <p className="text-[10px] text-center text-amber-400 animate-pulse">
                  Initializing FHE WebAssembly. Please wait...
                </p>
              )}
            </div>
          )}
        </div>

        {/* ─── Poll Insights Grid ─── */}
        <div className="bg-[#030305] border border-slate-900 rounded-2xl p-5 space-y-4">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3 text-[#FFD208]" />
            Poll Insights
          </span>

          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-3.5">
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider block">Total Ballots Cast</span>
              <div className="flex items-center gap-2 mt-1.5">
                <Users className="h-4 w-4 text-[#FFD208]" />
                <span className="text-lg font-black text-slate-100">{totalVotesCast}</span>
              </div>
              <span className="text-[9px] text-slate-600 mt-0.5 block">Encrypted</span>
            </div>

            <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-3.5">
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider block">Tally Secrecy</span>
              <div className="flex items-center gap-2 mt-1.5">
                {resultsRevealed ? <Unlock className="h-4 w-4 text-emerald-400" /> : <Lock className="h-4 w-4 text-[#FFD208]" />}
                <span className="text-sm font-bold text-slate-200">{resultsRevealed ? 'Revealed' : 'FHE Shielded'}</span>
              </div>
              <span className="text-[9px] text-slate-600 mt-0.5 block">{resultsRevealed ? 'Results visible' : 'Results hidden'}</span>
            </div>

            <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-3.5">
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider block">Double Voting Prevention</span>
              <div className="flex items-center gap-2 mt-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-bold text-slate-200">Active on-chain</span>
              </div>
              <span className="text-[9px] text-slate-600 mt-0.5 block">Protection enabled</span>
            </div>

            <div className="bg-slate-950/40 border border-slate-800/50 rounded-xl p-3.5">
              <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider block">Poll Status</span>
              <div className="flex items-center gap-2 mt-1.5">
                <Vote className="h-4 w-4 text-[#FFD208]" />
                <span className="text-sm font-bold text-slate-200">{status === 'Voting' ? 'Active' : status === 'Closed' ? 'Voting Ended' : 'Decrypted'}</span>
              </div>
              <span className="text-[9px] text-slate-600 mt-0.5 block">{resultsRevealed ? 'Results revealed' : 'Results locked'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* RIGHT SIDEBAR — FHE Summary + Decrypt      */}
      {/* ═══════════════════════════════════════════ */}
      <div className="space-y-5">

        {/* FHE Encryption Summary */}
        <div className="bg-[#030305] border border-slate-900 rounded-2xl p-5 space-y-5">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">FHE Encryption Summary</h4>

          <div className="space-y-4">
            <div className="flex gap-2.5 items-start">
              <div className="h-7 w-7 rounded-lg bg-[#FFD208]/10 border border-[#FFD208]/20 flex items-center justify-center shrink-0">
                <Shield className="h-3.5 w-3.5 text-[#FFD208]" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-200">Zero-Knowledge Shielding</span>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  Your choice is encrypted locally. Only the final result sum is ever visible.
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 items-start">
              <div className="h-7 w-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                <Key className="h-3.5 w-3.5 text-violet-400" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-200">Public Decryption Key</span>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  KMS holds the decryption key. Results unlock automatically after the deadline.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Decrypt & Reveal Results */}
        {status === 'Closed' && !resultsRevealed && (
          <div className="bg-[#0a0a12] border border-[#FFD208]/20 rounded-2xl p-5 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#FFD208]/5 blur-[60px] pointer-events-none" />
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2 relative">
              <Award className="h-4.5 w-4.5 text-[#FFD208]" />
              Decrypt & Reveal Results
            </h4>
            <p className="text-[10px] text-slate-500 leading-relaxed relative">
              The voting period has ended. Anyone can initiate the threshold KMS decryption callback to reveal the results.
            </p>

            <button
              onClick={handleRevealClick}
              disabled={loading}
              className="w-full bg-[#FFD208] text-black font-extrabold text-xs uppercase tracking-wider px-5 py-3 rounded-xl hover:bg-yellow-400 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed relative"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
              Decrypt & Reveal
            </button>

            {revealStep && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[9px] font-mono text-yellow-300 leading-relaxed relative">
                {revealStep}
              </div>
            )}
          </div>
        )}

        {/* Timeline Status */}
        <div className="bg-[#030305] border border-slate-900 rounded-2xl p-5 space-y-3 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-24 h-24 rounded-full bg-[#FFD208]/5 blur-[50px] pointer-events-none" />
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 relative">
            <Clock className="h-3 w-3 text-[#FFD208]" />
            Timeline Status
          </span>
          <p className="text-sm font-bold text-slate-200 leading-relaxed relative">{timeLeft || 'Loading...'}</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 font-medium">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
