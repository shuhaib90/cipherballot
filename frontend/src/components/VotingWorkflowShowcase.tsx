import { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { animate, stagger } from 'animejs';

import { Link, Shield, CheckCircle, Ticket, Vote, Fingerprint, Lock, ShieldCheck, Zap } from 'lucide-react';

interface WorkflowStep {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  code: { lang: string; lines: { text: string; color: string }[] };
  icon: React.ElementType;
  accentColor: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 1,
    title: 'CONNECT WALLET',
    subtitle: 'Authenticate',
    description: 'Citizens connect their Web3 wallet to authenticate with CipherBallot. The FHEVM WebAssembly module initializes client-side encryption primitives in the browser.',
    code: {
      lang: 'useWallet.ts',
      lines: [
        { text: '// 1. Initialize Web3 Provider', color: '#6b7280' },
        { text: 'const provider = new BrowserProvider(window.ethereum);', color: '#e2e8f0' },
        { text: 'const signer = await provider.getSigner();', color: '#e2e8f0' },
        { text: '', color: '' },
        { text: '// 2. Load FHEVM WASM Encryption Module', color: '#6b7280' },
        { text: 'const fhevmInstance = await createFhevmInstance({', color: '#FFFFFF' },
        { text: '  networkUrl: "https://devnet.zama.ai",', color: '#e2e8f0' },
        { text: '  gatewayUrl: "https://gateway.zama.ai"', color: '#e2e8f0' },
        { text: '});', color: '#FFFFFF' },
      ]
    },
    icon: Link,
    accentColor: '#3b82f6'
  },
  {
    id: 2,
    title: 'REGISTER IDENTITY',
    subtitle: 'FHE Encryption',
    description: 'Your personal documents are encrypted entirely in the browser using Fully Homomorphic Encryption. Only encrypted ciphertexts are submitted to the blockchain — zero plaintext ever leaves your device.',
    code: {
      lang: 'FHEIdentityRegistry.sol',
      lines: [
        { text: '// Encrypt identity document client-side', color: '#6b7280' },
        { text: 'function submitIdentityRequest(', color: '#c084fc' },
        { text: '  einput encryptedDoc,', color: '#FFFFFF' },
        { text: '  bytes calldata inputProof,', color: '#FFFFFF' },
        { text: '  bytes32 commitmentHash', color: '#e2e8f0' },
        { text: ') external {', color: '#c084fc' },
        { text: '  euint256 sealedDoc = TFHE.asEuint256(', color: '#FFFFFF' },
        { text: '    encryptedDoc, inputProof', color: '#e2e8f0' },
        { text: '  );', color: '#FFFFFF' },
        { text: '  // Store encrypted — never decrypted on-chain', color: '#6b7280' },
        { text: '}', color: '#c084fc' },
      ]
    },
    icon: Shield,
    accentColor: '#8b5cf6'
  },
  {
    id: 3,
    title: 'COMMISSIONER APPROVES',
    subtitle: 'Guardian Review',
    description: 'Network Guardians decrypt and review submitted documents using threshold MPC keys. Upon verification, they sign an approval signature that authorizes the citizen to mint their soulbound voter pass.',
    code: {
      lang: 'CommissionPanel.tsx',
      lines: [
        { text: '// Commissioner decrypts via KMS relay', color: '#6b7280' },
        { text: 'const plaintext = await fhevmInstance', color: '#e2e8f0' },
        { text: '  .reencrypt(encryptedHandle, keypair);', color: '#e2e8f0' },
        { text: '', color: '' },
        { text: '// Sign approval message off-chain', color: '#6b7280' },
        { text: 'const msgHash = solidityPackedKeccak256(', color: '#FFFFFF' },
        { text: '  ["address", "uint256", "bytes32"],', color: '#e2e8f0' },
        { text: '  [citizen, electionId, commitHash]', color: '#e2e8f0' },
        { text: ');', color: '#FFFFFF' },
        { text: 'const signature = await signer.signMessage(', color: '#34d399' },
        { text: '  getBytes(msgHash)', color: '#e2e8f0' },
        { text: ');', color: '#34d399' },
      ]
    },
    icon: CheckCircle,
    accentColor: '#10b981'
  },
  {
    id: 4,
    title: 'MINT VOTER PASS NFT',
    subtitle: 'Soulbound Token',
    description: 'Citizens mint a soulbound VEPass NFT — a dynamic on-chain SVG card that proves voting eligibility. The pass is non-transferable and cryptographically bound to the wallet address.',
    code: {
      lang: 'VoterEligibilityPass.sol',
      lines: [
        { text: '// Mint soulbound voter eligibility pass', color: '#6b7280' },
        { text: 'function mintVoterPass(', color: '#c084fc' },
        { text: '  einput encIdentity,', color: '#FFFFFF' },
        { text: '  bytes calldata identityProof,', color: '#e2e8f0' },
        { text: '  bytes calldata commissionSig', color: '#34d399' },
        { text: ') external {', color: '#c084fc' },
        { text: '  require(verifySignature(commissionSig));', color: '#f87171' },
        { text: '  uint256 tokenId = ++_tokenIdCounter;', color: '#e2e8f0' },
        { text: '  _safeMint(msg.sender, tokenId);', color: '#FFFFFF' },
        { text: '  // Renders dynamic on-chain SVG card', color: '#6b7280' },
        { text: '}', color: '#c084fc' },
      ]
    },
    icon: Ticket,
    accentColor: '#FFFFFF'
  },
  {
    id: 5,
    title: 'CAST SHIELDED BALLOT',
    subtitle: 'Homomorphic Vote',
    description: 'Your ballot choice is encrypted client-side and submitted as a ciphertext. The smart contract performs homomorphic addition directly on encrypted tallies — no vote is ever visible during the election.',
    code: {
      lang: 'Election.sol',
      lines: [
        { text: '// Cast encrypted vote (never visible)', color: '#6b7280' },
        { text: 'function castVote(', color: '#c084fc' },
        { text: '  einput encryptedChoice,', color: '#FFFFFF' },
        { text: '  bytes calldata proof', color: '#e2e8f0' },
        { text: ') external {', color: '#c084fc' },
        { text: '  euint8 choice = TFHE.asEuint8(', color: '#FFFFFF' },
        { text: '    encryptedChoice, proof);', color: '#e2e8f0' },
        { text: '  for (uint8 i = 0; i < count; i++) {', color: '#c084fc' },
        { text: '    ebool match = TFHE.eq(choice, i);', color: '#FFFFFF' },
        { text: '    tallies[i] = TFHE.add(tallies[i],', color: '#FFFFFF' },
        { text: '      TFHE.select(match, 1, 0));', color: '#e2e8f0' },
        { text: '  }', color: '#c084fc' },
        { text: '}', color: '#c084fc' },
      ]
    },
    icon: Vote,
    accentColor: '#f472b6'
  }
];

export function VotingWorkflowShowcase() {
  const [activeStep, setActiveStep] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const codeBlockRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Auto-cycle steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => (prev + 1) % WORKFLOW_STEPS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Typewriter effect for code
  useEffect(() => {
    setTypedChars(0);
    const step = WORKFLOW_STEPS[activeStep];
    const totalChars = step.code.lines.reduce((sum, l) => sum + l.text.length, 0);
    let current = 0;

    const interval = setInterval(() => {
      current++;
      setTypedChars(current);
      if (current >= totalChars) clearInterval(interval);
    }, 18);

    return () => clearInterval(interval);
  }, [activeStep]);

  // Anime.js animations on step change
  useEffect(() => {
    // Animate the active step card
    const activeCard = stepRefs.current[activeStep];
    if (activeCard) {
      animate(activeCard, {
        scale: [0.95, 1],
        opacity: [0.5, 1],
        duration: 500,
        easing: 'easeOutCubic'
      });
    }

    // Animate code block
    if (codeBlockRef.current) {
      animate(codeBlockRef.current, {
        translateY: [20, 0],
        opacity: [0, 1],
        duration: 600,
        easing: 'easeOutCubic'
      });
    }

    // Animate timeline progress dots
    if (timelineRef.current) {
      const dots = timelineRef.current.querySelectorAll('.timeline-dot');
      dots.forEach((dot, idx) => {
        animate(dot, {
          scale: idx === activeStep ? [1.5, 1.2] : [1, 1],
          duration: 400,
          easing: 'easeOutElastic(1, .5)'
        });
      });
    }
  }, [activeStep]);

  // Scroll-triggered entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animate(entry.target.querySelectorAll('.animate-on-scroll'), {
              translateY: [40, 0],
              opacity: [0, 1],
              delay: stagger(120),
              duration: 700,
              easing: 'easeOutCubic'
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const currentStep = WORKFLOW_STEPS[activeStep];

  return (
    <div ref={containerRef} className="space-y-12 border-b border-slate-955 pb-16 relative z-10">

      {/* Section Header */}
      <div className="text-center max-w-lg mx-auto space-y-2 animate-on-scroll">
        <span className="text-[10px] font-bold text-[#FFFFFF] uppercase tracking-widest font-mono">
          Animated Workflow
        </span>
        <h2 className="text-3xl font-black text-white">
          HOW CIPHERBALLOT WORKS
        </h2>
        <p className="text-xs text-slate-500 font-medium">
          From wallet connection to shielded ballot — every step visualized with live contract code.
        </p>
      </div>

      {/* Timeline Navigation */}
      <div ref={timelineRef} className="flex items-center justify-center gap-0 max-w-2xl mx-auto animate-on-scroll">
        {WORKFLOW_STEPS.map((step, idx) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => setActiveStep(idx)}
              className={`relative flex flex-col items-center gap-2 group transition-all duration-300 px-2 sm:px-4`}
            >
              {/* Dot */}
              <div
                className={`timeline-dot h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-sm sm:text-base font-black transition-all duration-300 border-2 ${
                  idx === activeStep
                    ? 'border-[#FFFFFF] bg-[#FFFFFF]/15 text-[#FFFFFF] shadow-[0_0_20px_rgba(255,210,8,0.3)]'
                    : idx < activeStep
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-800 bg-slate-950 text-slate-600'
                }`}
              >
                {idx < activeStep ? <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" /> : <step.icon className="h-4 w-4 sm:h-5 sm:w-5" />}
              </div>
              {/* Label */}
              <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider transition-colors duration-200 whitespace-nowrap ${
                idx === activeStep ? 'text-[#FFFFFF]' : 'text-slate-600'
              }`}>
                {step.subtitle}
              </span>
            </button>

            {/* Connector Line */}
            {idx < WORKFLOW_STEPS.length - 1 && (
              <div className={`h-[2px] w-4 sm:w-8 lg:w-12 transition-colors duration-500 ${
                idx < activeStep ? 'bg-emerald-500/40' : 'bg-slate-800'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Main Content: Active Step Display */}
      <div className="grid lg:grid-cols-2 gap-8 items-stretch animate-on-scroll">

        {/* Left: Step Info Card */}
        <div
          ref={el => { stepRefs.current[activeStep] = el; }}
          className="relative bg-[#030305] border border-slate-950 rounded-2xl p-8 sm:p-10 space-y-6 text-left overflow-hidden"
        >
          {/* Glow background */}
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-15 pointer-events-none transition-colors duration-500"
            style={{ backgroundColor: currentStep.accentColor }}
          />

          {/* Step Number Badge */}
          <div className="relative flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center text-xl border transition-all duration-300"
              style={{
                borderColor: `${currentStep.accentColor}33`,
                backgroundColor: `${currentStep.accentColor}10`,
              }}
            >
              <currentStep.icon className="h-6 w-6" style={{ color: currentStep.accentColor }} />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-widest font-mono" style={{ color: currentStep.accentColor }}>
                Step {currentStep.id} of {WORKFLOW_STEPS.length}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                {currentStep.title}
              </h3>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-slate-400 leading-relaxed font-medium relative">
            {currentStep.description}
          </p>

          {/* Wallet Popup Simulator */}
          <div className="relative pt-6 flex justify-center">
            <div className="bg-[#111318] border border-slate-800 rounded-xl w-[260px] sm:w-[280px] shadow-2xl overflow-hidden flex flex-col font-sans">
              {/* Wallet Header */}
              <div className="bg-[#1a1d24] px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center">
                    <Shield className="h-2 w-2 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-300">CipherWallet</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-800/50 px-2 py-0.5 rounded-full">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] text-slate-400 font-bold uppercase">Sepolia</span>
                </div>
              </div>

              {/* Wallet Content */}
              <div className="p-4 flex flex-col items-center text-center space-y-4">
                
                {/* Dynamic icon based on step */}
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ backgroundColor: currentStep.accentColor }} />
                  <div className="h-12 w-12 rounded-full flex items-center justify-center shadow-inner border border-white/5" style={{ backgroundColor: `${currentStep.accentColor}15` }}>
                    {activeStep === 0 && <Link className="h-6 w-6" style={{ color: currentStep.accentColor }} />}
                    {activeStep === 1 && <Fingerprint className="h-6 w-6" style={{ color: currentStep.accentColor }} />}
                    {activeStep === 2 && <ShieldCheck className="h-6 w-6" style={{ color: currentStep.accentColor }} />}
                    {activeStep === 3 && <Zap className="h-6 w-6" style={{ color: currentStep.accentColor }} />}
                    {activeStep === 4 && <Lock className="h-6 w-6" style={{ color: currentStep.accentColor }} />}
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-black text-slate-200">
                    {activeStep === 0 && "Connection Request"}
                    {activeStep === 1 && "Sign FHE Payload"}
                    {activeStep === 2 && "Guardian Access"}
                    {activeStep === 3 && "Mint Transaction"}
                    {activeStep === 4 && "Encrypt Ballot"}
                  </h4>
                  <p className="text-[9px] text-slate-500 px-2">
                    {activeStep === 0 && "cipherballot.com wants to connect to your wallet."}
                    {activeStep === 1 && "Encrypting identity details locally before transmission."}
                    {activeStep === 2 && "Verifying threshold signature from KMS Guardians."}
                    {activeStep === 3 && "Executing smart contract to mint Soulbound Pass."}
                    {activeStep === 4 && "Zero-knowledge proofs and homomorphic encryption."}
                  </p>
                </div>

                <div className="bg-[#0b0c10] w-full rounded p-2 text-left font-mono text-[8px] text-slate-500 overflow-hidden h-12 flex items-center border border-slate-900/50">
                  <span className="animate-pulse">
                    {activeStep === 0 && "0x7a3...c912 -> Auth"}
                    {activeStep === 1 && "0xEncryptedDocData..."}
                    {activeStep === 2 && "Pending Guardian Sig..."}
                    {activeStep === 3 && "Gas Est: 0.002 ETH"}
                    {activeStep === 4 && "TFHE.add(tallies[i], 1)"}
                  </span>
                </div>

                <div className="w-full pt-2">
                  <button 
                    className="w-full py-2 rounded text-[10px] font-bold text-black transition-colors"
                    style={{ backgroundColor: currentStep.accentColor }}
                  >
                    {activeStep === 0 && "Connect"}
                    {activeStep === 1 && "Sign & Encrypt"}
                    {activeStep === 2 && "Approve Request"}
                    {activeStep === 3 && "Confirm Mint"}
                    {activeStep === 4 && "Cast Shielded Vote"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-[6000ms] ease-linear"
              style={{
                width: '100%',
                backgroundColor: currentStep.accentColor,
                animation: 'progress-fill 6s linear infinite'
              }}
            />
          </div>
        </div>

        {/* Right: Live Code Runner */}
        <div
          ref={codeBlockRef}
          className="bg-[#030305] border border-slate-950 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Terminal Header */}
          <div className="bg-slate-950 border-b border-slate-900 px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              <div className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-slate-500 ml-2 font-mono font-bold">{currentStep.code.lang}</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full animate-pulse"
                style={{ backgroundColor: currentStep.accentColor }}
              />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: currentStep.accentColor }}>
                EXECUTING
              </span>
            </div>
          </div>

          {/* Code Content */}
          <div className="p-5 sm:p-6 font-mono text-[11px] sm:text-xs leading-relaxed flex-1 overflow-auto">
            <pre className="whitespace-pre-wrap">
              {(() => {
                let remaining = typedChars;
                return currentStep.code.lines.map((line, lineIdx) => {
                  if (remaining <= 0) return null;
                  const visibleText = line.text.substring(0, remaining);
                  remaining -= line.text.length;
                  return (
                    <div key={`${activeStep}-${lineIdx}`} className="flex">
                      <span className="text-slate-700 select-none w-6 shrink-0 text-right mr-3">
                        {lineIdx + 1}
                      </span>
                      <span style={{ color: line.color }}>{visibleText}</span>
                      {remaining <= 0 && remaining > -line.text.length && (
                        <span className="text-[#FFFFFF] animate-pulse font-bold ml-0.5">|</span>
                      )}
                    </div>
                  );
                });
              })()}
            </pre>
          </div>

          {/* Terminal Footer */}
          <div className="bg-slate-950 border-t border-slate-900 px-5 py-2.5 flex items-center justify-between shrink-0">
            <span className="text-[9px] text-slate-600 font-mono">
              // Step {currentStep.id}: {currentStep.subtitle}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-emerald-500 font-mono font-bold">✓ COMPILED</span>
              <span className="text-[9px] text-slate-600 font-mono">Zama FHEVM v2.0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step Quick-Select Cards (Mobile-friendly) */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3 max-w-3xl mx-auto animate-on-scroll">
        {WORKFLOW_STEPS.map((step, idx) => (
          <button
            key={step.id}
            onClick={() => setActiveStep(idx)}
            className={`p-3 sm:p-4 rounded-xl border text-center transition-all duration-300 group ${
              idx === activeStep
                ? 'border-[#FFFFFF]/40 bg-[#FFFFFF]/5 shadow-[0_0_15px_rgba(255,210,8,0.1)]'
                : 'border-slate-900 bg-[#030305] hover:border-slate-800'
            }`}
          >
            <div className="flex justify-center mb-1">
              <step.icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className={`text-[7px] sm:text-[8px] font-bold uppercase tracking-wider transition-colors ${
              idx === activeStep ? 'text-[#FFFFFF]' : 'text-slate-600 group-hover:text-slate-400'
            }`}>
              {step.subtitle}
            </div>
          </button>
        ))}
      </div>

      {/* CSS for progress animation */}
      <style>{`
        @keyframes progress-fill {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
