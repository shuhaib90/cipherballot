import { useState } from 'react';
import { Shield, Key, Vote, CheckCircle } from 'lucide-react';
import type { ElectionDetails } from '../hooks/useContract';

interface VotingBoothProps {
  election: ElectionDetails | null;
  isRegistered: boolean;
  isFheReady: boolean;
  onCastVote: (choiceIndex: number) => Promise<boolean>;
  loading: boolean;
}

export function VotingBooth({
  election,
  isRegistered,
  isFheReady,
  onCastVote,
  loading
}: VotingBoothProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [txSuccess, setTxSuccess] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  if (!election) {
    return (
      <div className="glass-panel p-8 text-center text-slate-400">
        Select an active election to enter the Voting Booth.
      </div>
    );
  }

  const { status, candidates, isVoted } = election;

  const handleVoteSubmit = async () => {
    if (selectedCandidate === null) return;
    setTxSuccess(false);
    setStatusMessage('1. Encrypting vote choice client-side...');
    
    // Slight delay to show encryption step to user (very nice UX)
    await new Promise(resolve => setTimeout(resolve, 800));
    
    setStatusMessage('2. Signing and broadcasting FHE-encrypted vote...');
    const success = await onCastVote(selectedCandidate);
    
    if (success) {
      setTxSuccess(true);
      setSelectedCandidate(null);
      setStatusMessage('Vote Cast Successfully! Your choice remains completely confidential.');
    } else {
      setStatusMessage('Voting failed. See error console.');
    }
  };

  const isVotingDisabled =
    loading ||
    isVoted ||
    status !== 'Voting' ||
    !isRegistered ||
    !isFheReady ||
    selectedCandidate === null;

  return (
    <div className="glass-panel p-6 relative overflow-hidden">
      {/* Glow Effect */}
      <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-indigo-500/5 blur-3xl"></div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Candidates List */}
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-xl font-bold font-sans text-slate-100 flex items-center gap-2">
              Confidential Voting Booth
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Select one candidate. Your choice is fully encrypted with FHE before leaving your browser.
            </p>
          </div>

          {status !== 'Voting' && (
            <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs text-amber-400 font-medium">
              Voting is not active for this election. Status: {status}
            </div>
          )}

          {!isRegistered && (
            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 font-medium">
              You are not registered in the Voter Registry. Register your wallet to enable voting.
            </div>
          )}

          {isVoted && (
            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-200">Ballot Cast Successfully</h4>
                <p className="text-xs text-slate-400 mt-1">
                  You have already voted in this election. Your double-vote protection has been activated.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {candidates.map((candidate, idx) => (
              <label
                key={idx}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isVoted || status !== 'Voting' || !isRegistered
                    ? 'opacity-65 cursor-not-allowed border-slate-800/80 bg-slate-900/20'
                    : selectedCandidate === idx
                    ? 'border-indigo-500/80 bg-indigo-500/10 ring-2 ring-indigo-500/20'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="candidate-selection"
                    checked={selectedCandidate === idx}
                    onChange={() => setSelectedCandidate(idx)}
                    disabled={isVoted || status !== 'Voting' || !isRegistered}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
                  />
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-lg border border-slate-850">
                    {candidate.symbol}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">{candidate.name}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{candidate.party}</p>
                  </div>
                </div>
                {selectedCandidate === idx && (
                  <span className="text-[10px] font-bold text-indigo-400 uppercase bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                    Selected
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Ballot Submission Details */}
        <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-slate-800/60 pt-6 md:pt-0 md:pl-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-300">FHE Encryption Summary</h4>
            
            <div className="space-y-3">
              <div className="flex gap-2.5 items-start text-xs">
                <Shield className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-slate-200">Zero-Knowledge Shielding</span>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    Your choice is encrypted locally. Only the final result sum is ever visible.
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 items-start text-xs">
                <Key className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold text-slate-200">Public Decryption Key</span>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    KMS holds the decryption key. Results unlock automatically after deadline.
                  </p>
                </div>
              </div>
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
          </div>

          <div className="mt-8 space-y-3">
            <button
              onClick={handleVoteSubmit}
              disabled={isVotingDisabled}
              className="btn-primary w-full py-3"
            >
              <Vote className="h-4.5 w-4.5" />
              Cast FHE-Encrypted Vote
            </button>

            {!isFheReady && isRegistered && status === 'Voting' && (
              <p className="text-[10px] text-center text-amber-400 animate-pulse">
                Initializing FHE WebAssembly. Please wait...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
