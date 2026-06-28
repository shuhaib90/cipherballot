
export function Documentation() {
  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* Embedded Document Wrapper */}
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl p-8 sm:p-12 shadow-xl font-serif leading-relaxed">
        
        {/* Document Header */}
        <header className="text-center border-b-2 border-slate-100 pb-8 mb-8">
          <div className="inline-block px-3 py-1 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[10px] font-bold uppercase tracking-wider font-sans mb-3">
            Technical Whitepaper
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-800 font-sans mb-2">
            CipherBallot: FHE Cryptographic Voting
          </h1>
          <p className="text-slate-500 font-sans text-sm sm:text-base italic">
            An end-to-end homomorphically encrypted election protocol running live on Ethereum Sepolia
          </p>
        </header>

        {/* Judge quick-test alert block */}
        <div className="mb-8 p-6 bg-yellow-50 border-l-4 border-[#FFD208] rounded-r-lg text-slate-800 font-sans">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
            🔑 Judge & Auditor Quick-Test Wallet
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            For rapid evaluation, you can import the following burner private key directly into MetaMask. It has been pre-registered as both a <strong>Voter</strong> and an <strong>Election Commissioner / Officer</strong>, providing instant access to vote, approve citizen requests, deploy new elections, and reveal encrypted results on Sepolia.
          </p>
          <div className="bg-slate-900 text-yellow-300 p-3 rounded-lg text-[11px] font-mono select-all overflow-x-auto border border-slate-800">
            0xc17e050709c8c16336e212b3bbcf44ddb263f14517a66e4b70b86b88c27e2f6e
          </div>
        </div>

        {/* Section 1: Introduction */}
        <section className="mb-10 text-justify">
          <h2 className="text-xl font-bold font-sans text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide">
            1. Introduction & The Trust Problem
          </h2>
          <p className="mb-4">
            Every election system throughout human history has shared the same fundamental vulnerability: the requirement of trust in a central party. In paper-based elections, we place trust in poll workers and election officials. We trust that ballots are not stuffed into boxes, counts are not manipulated, and physical transit is secure. Yet, there is no way for a single citizen to verify the result without physically recounting millions of sheets of paper themselves.
          </p>
          <p className="mb-4">
            Digital elections merely shift this trust from physical workers to database administrators, server hosting providers, and software engineers. A database admin can run SQL updates to alter counts silently, server software can contain bugs or backdoors, and voting machines are vulnerable to hacking. Without total code access and system logs, public auditability remains non-existent.
          </p>
          <p className="mb-4">
            While blockchain elections attempted to solve this by making votes public and transparent on an immutable ledger, they fell short. Traditional blockchain voting requires votes to be encrypted using keys managed by a centralized server. This server remains a single point of failure and control. The election authority holds the decryption keys, meaning they can peek at the votes at any time, compromising voter privacy.
          </p>
        </section>

        {/* Section 2: The Solution */}
        <section className="mb-10 text-justify">
          <h2 className="text-xl font-bold font-sans text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide">
            2. The CipherBallot Solution
          </h2>
          <p className="mb-4">
            Instead of trusting institutions or individuals, CipherBallot trusts mathematics. By employing <strong>Fully Homomorphic Encryption (FHE)</strong>, CipherBallot ensures that ballots remain completely encrypted throughout the entire collection and calculation processes. Smart contracts run comparisons and increment candidate tallies directly on encrypted ciphertexts. The results are decrypted only as a final sum at the end of the voting window, ensuring individual votes are never exposed.
          </p>
        </section>

        {/* Section 3: The Citizen's Journey */}
        <section className="mb-10 text-justify">
          <h2 className="text-xl font-bold font-sans text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide">
            3. The Citizen's Journey
          </h2>
          
          <div className="border-l-4 border-amber-600 pl-4 mb-6">
            <h4 className="text-sm font-bold text-amber-700 uppercase tracking-widest font-sans mb-1">Step 1 — Registration & Local Encryption</h4>
            <p className="text-sm text-slate-700 mb-2">
              A citizen goes to the registration portal. They input their name, date of birth, and government ID number. The browser uses the Zama Wasm SDK to encrypt details locally into 32-byte chunks (euint256 ciphertexts) and computes a verification commitment hash. The plaintext never touches the network.
            </p>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-xs font-sans text-slate-600 mt-2">
              <span className="font-bold text-slate-800 block mb-1">Technical Implementation Details:</span>
              The browser splits the serialized identity fields into 32-byte chunks, encrypts each chunk as an <code>euint256</code> on-chain handle, and submits them along with the document hash. The registry smart contract registers the pending request with status <code>Pending</code>.
            </div>
          </div>

          <div className="border-l-4 border-amber-600 pl-4 mb-6">
            <h4 className="text-sm font-bold text-amber-700 uppercase tracking-widest font-sans mb-1">Step 2 — Commissioner Audit & Whitelisting</h4>
            <p className="text-sm text-slate-700 mb-2">
              The Election Commission audits the request. Because the document is encrypted on-chain, the contract explicitly delegates decryption rights only to authorized commissioners. The commissioner decrypts the data locally on their machine to verify.
            </p>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-xs font-sans text-slate-600 mt-2">
              <span className="font-bold text-slate-800 block mb-1">Technical Implementation Details:</span>
              The registry smart contract uses <code>FHE.allow()</code> to grant permission handles to commissioner wallets. Upon verification, the commissioner signs approval, which automatically calls <code>VoterRegistry.registerVoter()</code>, whitelisting the citizen's wallet.
            </div>
          </div>

          <div className="border-l-4 border-amber-600 pl-4 mb-6">
            <h4 className="text-sm font-bold text-amber-700 uppercase tracking-widest font-sans mb-1">Step 3 — Shielded Vote Casting</h4>
            <p className="text-sm text-slate-700 mb-2">
              On election day, voters select their candidate and cast an FHE-encrypted index. The contract increments the chosen candidate's encrypted tally: <code>FHE.select(FHE.eq(choice, candidateIndex), 1, 0)</code>. The contract tallies votes without ever knowing what they are.
            </p>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg text-xs font-sans text-slate-600 mt-2">
              <span className="font-bold text-slate-800 block mb-1">Technical Implementation Details:</span>
              The contract runs FHE operations directly on the user's encrypted <code>euint8</code> vote index. It updates the candidate running sum using homomorphic addition, maintaining secrecy from voters, node operators, and commissioners.
            </div>
          </div>
        </section>

        {/* Section 4: Why FHE is Essential */}
        <section className="mb-10 text-justify">
          <h2 className="text-xl font-bold font-sans text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide">
            4. Why FHE is Essential
          </h2>
          <p className="mb-4">
            Traditional Zero-Knowledge Proofs (ZKPs) can prove a vote is valid but cannot calculate tallies on hidden states. To count ZKP ballots, you must decrypt them individually, losing privacy.
          </p>
          <p className="mb-4">
            Fully Homomorphic Encryption (FHE) is the only technology that allows us to calculate sums directly on ciphertext. If Voter 1 chooses candidate A (encrypted) and Voter 2 chooses candidate A (encrypted), the smart contract can run FHE.add() to compute an encrypted sum of 2. The contract counts the votes without ever knowing what the votes actually were. This makes vote sealing absolute, securing privacy from the citizen's browser to the final tally.
          </p>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg font-mono text-xs text-slate-800 overflow-x-auto">
            encrypted_tally[candidate] = FHE.add(encrypted_tally[candidate], FHE.select(FHE.eq(vote, candidate), 1, 0))
          </div>
        </section>

        {/* Section 5: Technical Architecture */}
        <section className="mb-10">
          <h2 className="text-xl font-bold font-sans text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide">
            5. Smart Contract Architecture
          </h2>
          <p className="mb-4 text-justify">
            CipherBallot operates via four cooperative smart contracts:
          </p>
          <ul className="list-disc pl-5 mb-4 text-slate-700 text-sm space-y-2 font-sans">
            <li><strong>VoterRegistry.sol</strong>: Manages the eligibility whitelist of wallets and voter verification hashes.</li>
            <li><strong>ElectionFactory.sol</strong>: Deploys individual election contracts and hosts metadata.</li>
            <li><strong>Election.sol</strong>: Manages the voting process, performs on-chain FHE tallies, and interfaces with the KMS.</li>
            <li><strong>FHEIdentityRegistry.sol</strong>: Stores encrypted document chunks and manages commissioner verifications.</li>
          </ul>
        </section>

        {/* Section 6: Verification on Sepolia */}
        <section className="mb-6">
          <h2 className="text-xl font-bold font-sans text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide">
            6. Verification on Ethereum Sepolia
          </h2>
          <p className="text-justify">
            CipherBallot is fully functional and deployed on the <strong>Ethereum Sepolia</strong> testnet. You can verify the execution by connecting your wallet to the portal, submitting registration requests, casting ballots, and auditing the transaction logs and KMS threshold proofs directly on Sepolia Etherscan.
          </p>
        </section>

        <footer className="text-center text-slate-400 text-xs mt-8 pt-4 border-t border-slate-100 font-sans">
          CipherBallot Protocol &copy; 2026. Built with Zama FHEVM.
        </footer>
      </div>
    </div>
  );
}
