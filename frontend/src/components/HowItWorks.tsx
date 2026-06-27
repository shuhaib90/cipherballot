import { Shield, Lock, Cpu, Key, HelpCircle } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Local Client-Side Encryption',
      description: 'Your choices and identity document chunk data are encrypted directly inside your browser using the Zama FHE WebAssembly SDK before hitting the network. Only the encrypted handles (mathematical references) are sent to the blockchain.',
      icon: <Lock className="h-6 w-6 text-violet-400" />,
      glowColor: 'from-violet-500/20 to-purple-500/0'
    },
    {
      number: '02',
      title: 'On-Chain FHE Computations',
      description: 'Smart contracts process the encrypted choices. Because the smart contract has FHE instructions, it can compare the choices and add them to the tally without ever decrypting them. Votes remain fully shielded, preventing any mid-election leaks.',
      icon: <Cpu className="h-6 w-6 text-indigo-400" />,
      glowColor: 'from-indigo-500/20 to-blue-500/0'
    },
    {
      number: '03',
      title: 'KMS Threshold Decryption',
      description: 'Once the election finishes, the Commission requests decryption. The Zama KMS (Key Management System) relayer network computes threshold decryption signatures off-chain, proving the correctness of the decryption without exposing the private keys.',
      icon: <Key className="h-6 w-6 text-purple-400" />,
      glowColor: 'from-purple-500/20 to-pink-500/0'
    },
    {
      number: '04',
      title: 'On-Chain Signature Verification',
      description: 'The final cleartext results along with the KMS signatures are submitted back to the contract. The contract verifies the signatures using cryptographically secure proofs. If the check passes, the final tallies are unlocked publicly.',
      icon: <Shield className="h-6 w-6 text-emerald-400" />,
      glowColor: 'from-emerald-500/20 to-teal-500/0'
    }
  ];

  const features = [
    {
      title: 'Voter Anonymity',
      desc: 'No one — not even the Election Commission or the node validators — can see who you voted for.'
    },
    {
      title: 'Identity Verification',
      desc: 'Verify your government documents using zero-knowledge-like client FHE shielding, proving eligibility securely.'
    },
    {
      title: 'Auditable Results',
      desc: 'Anyone can audit the contract execution, verify the KMS relayer signatures, and validate the correct tallies.'
    }
  ];

  return (
    <div className="space-y-12 py-4">
      {/* Hero Intro */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-xs font-semibold text-violet-400 shadow-md">
          <HelpCircle className="h-3.5 w-3.5" />
          Technical Walkthrough
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl font-sans">
          How <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">CipherBallot</span> Works
        </h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
          CipherBallot uses state-of-the-art Fully Homomorphic Encryption (FHE) powered by Zama's fhEVM. 
          This allows computations to run directly on encrypted data, ensuring absolute voter privacy and secure audit trails.
        </p>
      </div>

      {/* Step by Step Timeline */}
      <div className="grid gap-6 md:grid-cols-2 max-w-6xl mx-auto">
        {steps.map((step, idx) => (
          <div key={idx} className="glow-card group">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${step.glowColor} blur-2xl opacity-50 group-hover:opacity-80 transition-opacity duration-300 pointer-events-none`} />
            
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-4">
                <span className="text-[10px] font-black tracking-widest text-violet-500 uppercase">Step {step.number}</span>
                <h3 className="text-lg font-bold text-slate-100 group-hover:text-violet-300 transition-colors duration-200">{step.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">{step.description}</p>
              </div>

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 border border-violet-500/10 group-hover:border-violet-500/30 group-hover:shadow-[0_0_15px_rgba(139,92,246,0.1)] transition-all duration-300">
                {step.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Technical FAQ / Summary Grid */}
      <div className="max-w-4xl mx-auto bg-slate-950/40 border border-violet-500/10 rounded-2xl p-6 sm:p-8 space-y-6">
        <h3 className="text-xl font-bold text-center bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Cryptographic Guarantees</h3>
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((feat, idx) => (
            <div key={idx} className="space-y-2 border-r border-violet-500/10 last:border-0 pr-4 last:pr-0">
              <h4 className="text-sm font-bold text-violet-400">{feat.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
