import { HelpCircle } from 'lucide-react';

export function HowItWorks() {
  return (
    <div className="space-y-12 py-4 text-left max-w-4xl mx-auto">
      {/* Hero Intro */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-yellow-500/20 bg-yellow-500/5 text-xs font-semibold text-yellow-400 shadow-md">
          <HelpCircle className="h-3.5 w-3.5" />
          Technical & Practical Guide
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl font-sans">
          How <span className="bg-gradient-to-r from-white via-yellow-200 to-yellow-400 bg-clip-text text-transparent">CipherBallot</span> Works
        </h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
          CipherBallot uses Fully Homomorphic Encryption (FHE) powered by Zama's fhEVM to keep election ballots and identity records sealed during computation.
        </p>
      </div>

      {/* Section 1: The Problem & The Solution */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="glass-panel p-6 space-y-3">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-900 pb-2">
            <span className="text-[#FFD208] font-mono">01.</span> The Trust Problem
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every election in history relies on a trusted authority. In paper systems, we trust poll workers not to stuff boxes. In digital voting, we trust database admins and software engineers not to modify votes. Traditional blockchain voting transparently leaks ballot transaction trails, compromising secrecy.
          </p>
        </div>

        <div className="glass-panel p-6 space-y-3">
          <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-900 pb-2">
            <span className="text-[#FFD208] font-mono">02.</span> The Math Solution
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            CipherBallot trusts mathematics instead of institutions. Using Fully Homomorphic Encryption (FHE), votes are tallied while fully encrypted. The running sums are updated on-chain in their ciphertext state, guaranteeing complete secrecy from ballot cast to reveal.
          </p>
        </div>
      </div>

      {/* Section 2: Timeline Steps */}
      <div className="space-y-6">
        <h3 className="text-xl font-extrabold text-slate-100 border-l-4 border-yellow-500 pl-3">The Voter's Journey</h3>
        
        <div className="space-y-4">
          {/* Step 1 */}
          <div className="glass-panel p-6 space-y-3">
            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Step 1 — Registration & Local Encryption</span>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Voters enter their name and government ID. The browser uses Zama's Wasm SDK to encrypt details locally into 32-byte chunks (euint256 ciphertexts) and generates a verification commitment hash. The plaintext never touches the network.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-panel p-6 space-y-3">
            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Step 2 — Commissioner Audit & Whitelisting</span>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              The Election Commission accesses documents via FHE.allow() permissions and decrypts them locally to verify government credentials. Approving the request automatically whitelists the voter's wallet address in the on-chain VoterRegistry.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-panel p-6 space-y-3">
            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Step 3 — Shielded Vote Casting</span>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Voters select their candidate and cast an FHE-encrypted index. The contract increments the chosen candidate's encrypted tally: FHE.select(FHE.eq(choice, candidateIndex), 1, 0). The contract tallies votes without ever knowing what they are.
            </p>
          </div>

          {/* Step 4 */}
          <div className="glass-panel p-6 space-y-3">
            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Step 4 — KMS Quorum Reveal</span>
            <p className="text-xs text-slate-400 leading-relaxed font-medium">
              Once voting closes, a validator triggers reveal. Zama's decentralized Key Management System (KMS) uses Multi-Party Computation (MPC) to decrypt only the final sums, leaving individual ballot details hidden forever.
            </p>
          </div>
        </div>
      </div>

      {/* Section 3: Why FHE is Essential */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-900 pb-2">
          Why FHE is Crucial (Not Just For Show)
        </h3>
        <div className="text-xs text-slate-400 space-y-3 leading-relaxed font-medium">
          <p>
            Traditional Zero-Knowledge Proofs (ZKPs) can prove a vote is valid but cannot calculate tallies on hidden states. To count ZKP ballots, you must decrypt them individually, losing privacy.
          </p>
          <p>
            CipherBallot uses FHE arithmetic:
            <code className="block bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-yellow-400 font-mono mt-1.5 overflow-x-auto text-[11px]">
              encrypted_tally[candidate] = FHE.add(encrypted_tally[candidate], FHE.select(FHE.eq(vote, candidate), 1, 0))
            </code>
            This allows public, on-chain ballot calculation while ensuring the contents remain secret.
          </p>
        </div>
      </div>

      {/* Section 4: Live on Sepolia */}
      <div className="glass-panel p-6 space-y-3 border-emerald-500/10">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
          Live on Sepolia Testnet
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed font-medium">
          CipherBallot is fully deployed on Ethereum Sepolia. Anyone can connect their Web3 wallet, submit FHE-shielded registration data, vote, and verify the resulting transactions, logic, and KMS signatures directly on Etherscan.
        </p>
      </div>
    </div>
  );
}
