import { useState, useEffect } from 'react';
import { UserCheck, ShieldAlert, Key, Clipboard, Check } from 'lucide-react';
import { ethers } from 'ethers';

interface VoterStatusProps {
  address: string;
  isRegistered: boolean;
  onCheckStatus: () => Promise<void>;
}

export function VoterStatus({ address, isRegistered, onCheckStatus }: VoterStatusProps) {
  const [saltInput, setSaltInput] = useState<string>('VOTER_SALT');
  const [calculatedHash, setCalculatedHash] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Auto check status on load
  useEffect(() => {
    if (address) {
      onCheckStatus();
    }
  }, [address, onCheckStatus]);

  const handleCalculateHash = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    
    // Hash voterAddress + salt
    const hash = ethers.solidityPackedKeccak256(
      ['address', 'string'],
      [address, saltInput || 'VOTER_SALT']
    );
    setCalculatedHash(hash);
  };

  const copyToClipboard = () => {
    if (!calculatedHash) return;
    navigator.clipboard.writeText(calculatedHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Registration Status Panel */}
      <div className="glass-panel p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold font-sans text-slate-100 flex items-center gap-2 mb-2">
            Voter Eligibility Status
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            The Voter Registry ensures that only citizens registered by the Election Commission can cast a vote.
          </p>

          <div className="flex items-center gap-4 p-4 rounded-xl border bg-slate-950/40 border-slate-800">
            {isRegistered ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Registered</span>
                  <h4 className="text-sm font-bold text-slate-200 mt-0.5">Eligible to Vote</h4>
                  <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[200px] sm:max-w-xs">
                    Your wallet address has been verified.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Not Registered</span>
                  <h4 className="text-sm font-bold text-slate-200 mt-0.5">Ineligible to Vote</h4>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Contact the Election Commission to register this wallet.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onCheckStatus}
          className="btn-secondary w-full mt-6 text-xs"
        >
          Check Status on Blockchain
        </button>
      </div>

      {/* Voter Hash Generator Panel */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold font-sans text-slate-100 flex items-center gap-2 mb-2">
          Local Voter ID Hash Calculator
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Generate your zero-knowledge Voter ID Hash locally. Submit this hash to the Commission to request registration.
        </p>

        <form onSubmit={handleCalculateHash} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Secret Salt (Shared with Commission)
            </label>
            <input
              type="text"
              value={saltInput}
              onChange={(e) => setSaltInput(e.target.value)}
              placeholder="e.g. VOTER_SALT"
              className="input-field py-2 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={!address}
            className="btn-primary w-full py-2 text-xs"
          >
            <Key className="h-3.5 w-3.5" />
            Calculate Hash
          </button>
        </form>

        {calculatedHash && (
          <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
            <div className="overflow-hidden">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Voter ID Hash</span>
              <p className="font-mono text-xs text-indigo-300 truncate">{calculatedHash}</p>
            </div>
            <button
              onClick={copyToClipboard}
              className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition duration-150 shrink-0"
              title="Copy Hash"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
