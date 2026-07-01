import { useState } from 'react';

export function Documentation() {
  const [activeSection, setActiveSection] = useState('introduction');

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const sections = [
    {
      group: 'Overview',
      items: [
        { id: 'introduction', label: 'Introduction' },
        { id: 'solution', label: 'The Solution' },
        { id: 'quick-test', label: 'Quick-Test Wallet' }
      ]
    },
    {
      group: 'Voter\'s Journey',
      items: [
        { id: 'step-1', label: '1. Local Encryption' },
        { id: 'step-2', label: '2. Commissioner Review' },
        { id: 'step-3', label: '3. Shielded Vote' },
        { id: 'step-4', label: '4. Quorum Decryption' }
      ]
    },
    {
      group: 'Core Technology',
      items: [
        { id: 'why-fhe', label: 'Why FHE is Essential' },
        { id: 'architecture', label: 'Contract Architecture' }
      ]
    },
    {
      group: 'Verification',
      items: [
        { id: 'sepolia', label: 'Live on Sepolia' }
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto py-4 px-2 sm:px-6">
      {/* Riddle UI Style Documentation Page */}
      <div className="bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-xl flex min-h-[75vh] overflow-hidden">
        
        {/* Left Sidebar (Overview / Navigation) */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-100 p-8 bg-slate-50/50">
          <div className="space-y-8 sticky top-8">
            <div className="flex items-center gap-2 mb-6">
              <img src="/logo.png" alt="CipherBallot Logo" className="h-5 w-5 object-contain" />
              <span className="text-xs font-black tracking-wider text-slate-800 uppercase font-sans">
                CipherBallot Docs
              </span>
            </div>

            {sections.map((group) => (
              <div key={group.group} className="space-y-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                  {group.group}
                </h4>
                <ul className="space-y-1 font-sans text-xs font-semibold">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => scrollToSection(item.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition duration-150 ${
                          activeSection === item.id
                            ? 'bg-slate-100 text-slate-900 font-bold'
                            : 'text-slate-500 hover:text-slate-850 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Center Content Column */}
        <main className="flex-1 min-w-0 p-8 sm:p-12 md:p-16 bg-white overflow-y-auto max-h-[85vh]">
          <div className="max-w-2xl space-y-12 text-slate-800 font-serif leading-relaxed text-justify">
            
            {/* Introduction */}
            <section id="introduction" className="space-y-4">
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans text-left">
                Introduction & The Trust Problem
              </h1>
              <p>
                Every election system throughout human history has shared the same fundamental vulnerability: the requirement of trust in a central party. In paper-based elections, we place trust in poll workers and election officials. We trust that ballots are not stuffed into boxes, counts are not manipulated, and physical transit is secure. Yet, there is no way for a single citizen to verify the result without physically recounting millions of sheets of paper themselves.
              </p>
              <p>
                Digital elections merely shift this trust from physical workers to database administrators, server hosting providers, and software engineers. A database admin can run SQL updates to alter counts silently, server software can contain bugs or backdoors, and voting machines are vulnerable to hacking. Without total code access and system logs, public auditability remains non-existent.
              </p>
              <p>
                While blockchain elections attempted to solve this by making votes public and transparent on an immutable ledger, they fell short. Traditional blockchain voting requires votes to be encrypted using keys managed by a centralized server. This server remains a single point of failure and control. The election authority holds the decryption keys, meaning they can peek at the votes at any time, compromising voter privacy.
              </p>
            </section>

            {/* The Solution */}
            <section id="solution" className="space-y-4 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans text-left">
                The CipherBallot Solution
              </h2>
              <p>
                Instead of trusting institutions or individuals, CipherBallot trusts mathematics. By employing <strong>Fully Homomorphic Encryption (FHE)</strong>, CipherBallot ensures that ballots remain completely encrypted throughout the entire collection and calculation processes. Smart contracts run comparisons and increment candidate tallies directly on encrypted ciphertexts. The results are decrypted only as a final sum at the end of the voting window, ensuring individual votes are never exposed.
              </p>
            </section>

            {/* Quick-Test Wallet */}
            <section id="quick-test" className="space-y-4 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans text-left">
                🔑 Judge & Auditor Quick-Test Wallet
              </h2>
              <p>
                For rapid evaluation, you can import the following burner private key directly into MetaMask. It has been pre-registered as both a <strong>Voter</strong> and an <strong>Election Commissioner / Officer</strong>, providing instant access to vote, approve citizen requests, deploy new elections, and reveal encrypted results on Sepolia.
              </p>
              <div className="bg-slate-950 text-yellow-300 p-4 rounded-xl text-xs font-mono select-all overflow-x-auto border border-slate-800 leading-normal text-center">
                0xc17e050709c8c16336e212b3bbcf44ddb263f14517a66e4b70b86b88c27e2f6e
              </div>
            </section>

            {/* Step 1 */}
            <section id="step-1" className="space-y-4 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans text-left">
                Step 1: Registration & Local Encryption
              </h2>
              <p>
                A citizen goes to the registration portal. They input their name, date of birth, and government ID number. The browser uses the Zama Wasm SDK to encrypt details locally into 32-byte chunks (euint256 ciphertexts) and computes a verification commitment hash. The plaintext never touches the network.
              </p>
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-xs font-sans text-slate-600 space-y-2 text-left">
                <span className="font-bold text-slate-800 block">Technical Details:</span>
                <p>
                  The browser splits the serialized identity fields into 32-byte chunks, encrypts each chunk as an <code>euint256</code> on-chain handle, and submits them along with the document hash. The registry smart contract registers the pending request with status <code>Pending</code>.
                </p>
              </div>
            </section>

            {/* Step 2 */}
            <section id="step-2" className="space-y-4 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans text-left">
                Step 2: Commissioner Review & Whitelisting
              </h2>
              <p>
                The Election Commission audits the request. Because the document is encrypted on-chain, the contract explicitly delegates decryption rights only to authorized commissioners. The commissioner decrypts the data locally on their machine to verify.
              </p>
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-xs font-sans text-slate-600 space-y-2 text-left">
                <span className="font-bold text-slate-800 block">Technical Details:</span>
                <p>
                  The registry smart contract uses <code>FHE.allow()</code> to grant permission handles to commissioner wallets. Upon verification, the commissioner signs approval, which automatically calls <code>VoterRegistry.registerVoter()</code>, whitelisting the citizen's wallet.
                </p>
              </div>
            </section>

            {/* Step 3 */}
            <section id="step-3" className="space-y-4 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans text-left">
                Step 3: Shielded Vote Casting
              </h2>
              <p>
                On election day, voters select their candidate and cast an FHE-encrypted index. The contract increments the chosen candidate's encrypted tally: <code>FHE.select(FHE.eq(choice, candidateIndex), 1, 0)</code>. The contract tallies votes without ever knowing what they are.
              </p>
              <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-xs font-sans text-slate-600 space-y-2 text-left">
                <span className="font-bold text-slate-800 block">Technical Details:</span>
                <p>
                  The contract runs FHE operations directly on the user's encrypted <code>euint8</code> vote index. It updates the candidate running sum using homomorphic addition, maintaining secrecy from voters, node operators, and commissioners.
                </p>
              </div>
            </section>

            {/* Step 4 */}
            <section id="step-4" className="space-y-4 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans text-left">
                Step 4: Quorum Decryption & Results Reveal
              </h2>
              <p>
                Once voting closes, a validator triggers reveal. Zama's decentralized Key Management System (KMS) uses Multi-Party Computation (MPC) to decrypt only the final sums, leaving individual ballot details hidden forever.
              </p>
            </section>

            {/* Why FHE */}
            <section id="why-fhe" className="space-y-4 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans text-left">
                Why FHE is Essential
              </h2>
              <p>
                Traditional Zero-Knowledge Proofs (ZKPs) can prove a vote is valid but cannot calculate tallies on hidden states. To count ZKP ballots, you must decrypt them individually, losing privacy.
              </p>
              <p>
                Fully Homomorphic Encryption (FHE) is the only technology that allows us to calculate sums directly on ciphertext. The contract counts the votes without ever knowing what the votes actually were, ensuring absolute voter privacy.
              </p>
              <div className="bg-slate-950 text-slate-300 p-4 rounded-xl font-mono text-[11px] overflow-x-auto border border-slate-800 leading-normal">
                encrypted_tally[candidate] = FHE.add(encrypted_tally[candidate], FHE.select(FHE.eq(vote, candidate), 1, 0))
              </div>
            </section>

            {/* Architecture */}
            <section id="architecture" className="space-y-4 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans text-left">
                Smart Contract Architecture
              </h2>
              <p>
                CipherBallot operates via four cooperative smart contracts:
              </p>
              <ul className="list-disc pl-5 font-sans text-xs text-slate-600 space-y-2.5 text-left">
                <li><strong>VoterRegistry.sol</strong>: Manages the eligibility whitelist of wallets and voter verification hashes.</li>
                <li><strong>ElectionFactory.sol</strong>: Deploys individual election contracts and hosts metadata.</li>
                <li><strong>Election.sol</strong>: Manages the voting process, performs on-chain FHE tallies, and interfaces with the KMS.</li>
                <li><strong>FHEIdentityRegistry.sol</strong>: Stores encrypted document chunks and manages commissioner verifications.</li>
              </ul>
            </section>

            {/* Sepolia */}
            <section id="sepolia" className="space-y-4 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans text-left">
                Verification on Ethereum Sepolia
              </h2>
              <p>
                CipherBallot is fully functional and deployed on the <strong>Ethereum Sepolia</strong> testnet. You can verify the execution by connecting your wallet to the portal, submitting registration requests, casting ballots, and auditing the transaction logs and KMS threshold proofs directly on Sepolia Etherscan.
              </p>
            </section>
          </div>
        </main>

        {/* Right Sidebar (On this page outline) */}
        <aside className="hidden xl:block w-48 shrink-0 border-l border-slate-100 p-8">
          <div className="space-y-4 sticky top-8 text-left">
            <h4 className="text-[10px] font-bold text-slate-455 uppercase tracking-wider font-sans">
              On this page
            </h4>
            <ul className="space-y-2.5 font-sans text-[11px] font-semibold text-slate-400">
              {sections.map((group) =>
                group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => scrollToSection(item.id)}
                      className={`hover:text-slate-700 transition duration-150 ${
                        activeSection === item.id ? 'text-amber-600 border-l-2 border-amber-500 pl-2 font-bold' : ''
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>

      </div>
    </div>
  );
}
