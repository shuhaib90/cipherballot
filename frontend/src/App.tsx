import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Header } from './components/Header';
import { VoterStatus } from './components/VoterStatus';
import { VotingBooth } from './components/VotingBooth';
import { ResultsDashboard } from './components/ResultsDashboard';
import { CommissionPanel } from './components/CommissionPanel';
import { IdentityVerification } from './components/IdentityVerification';
import { HowItWorks } from './components/HowItWorks';
import { Documentation } from './components/Documentation';
import { ElectionShareCard } from './components/ElectionShareCard';
import { useWallet } from './hooks/useWallet';
import { useFhevm } from './hooks/useFhevm';
import { useContract, type ElectionDetails } from './hooks/useContract';
import { X, ShieldCheck, RefreshCw, Lock, Cpu, EyeOff, ShieldAlert, ArrowRight, Share2, Github, Linkedin, Twitter } from 'lucide-react';
import type { CitizenStatus } from './utils/types';

const REAL_PROJECT_CODE_LINES = [
  "// SPDX-License-Identifier: BSD-3-Clause-Clear",
  "pragma solidity ^0.8.24;",
  "",
  "import \"fhevm/lib/TFHE.sol\";",
  "import \"./VoterRegistry.sol\";",
  "",
  "contract Election {",
  "    string public name;",
  "    string public description;",
  "    ",
  "    // Encrypted tallies for candidates",
  "    mapping(uint8 => euint32) internal encryptedTallies;",
  "    mapping(address => bool) public hasVoted;",
  "    ",
  "    constructor(string memory _name, string[] memory _candidates) {",
  "        name = _name;",
  "        for (uint8 i = 0; i < _candidates.length; i++) {",
  "            encryptedTallies[i] = TFHE.asEuint32(0);",
  "        }",
  "    }",
  "    ",
  "    function castVote(bytes calldata encryptedChoice, bytes calldata proof) external {",
  "        require(!hasVoted[msg.sender], \"Already voted\");",
  "        euint8 choice = TFHE.asEuint8(encryptedChoice);",
  "        TFHE.req(TFHE.isSenderAllowed(choice));",
  "        ",
  "        for (uint8 i = 0; i < candidateCount; i++) {",
  "            ebool isChosen = TFHE.eq(choice, TFHE.asEuint8(i));",
  "            euint32 inc = TFHE.select(isChosen, TFHE.asEuint32(1), TFHE.asEuint32(0));",
  "            encryptedTallies[i] = TFHE.add(encryptedTallies[i], inc);",
  "        }",
  "        hasVoted[msg.sender] = true;",
  "    }",
  "}",
  "// End of FHE Cryptographic Ballot Protocol"
];

function App() {
  const {
    address,
    isConnected,
    chainId,
    signer,
    provider,
    connect,
    disconnect,
    error: walletError
  } = useWallet();

  const {
    fhevmInstance,
    isInitializing: isFheInitializing,
    encryptChoice,
    encryptIdentityDocument,
    reinitialize: reinitFhe
  } = useFhevm(provider, chainId);

  const {
    loading: contractLoading,
    error: contractError,
    isVoterRegistered,
    registerVoter,
    registerVotersBatch,
    createElection,
    getElectionsList,
    getElectionDetails,
    castVote,
    requestRevealResults,
    decryptAndFinalizeResults,
    isUserCommissionOfficer,
    fetchCitizenStatus,
    submitIdentityRequest,
    resubmitIdentityRequest,
    fetchPendingRequests,
    fetchAllRequests,
    approveIdentityRequest,
    rejectIdentityRequest,
    decryptIdentityDocument,
    appointCommissioner,
    delegateRequestAccess,
    fetchCommissionersList
  } = useContract(provider, signer, address);

  const [activeTab, setActiveTab] = useState<'landing' | 'register' | 'elections' | 'voter-status' | 'commission' | 'how-it-works' | 'docs'>('landing');
  const [elections, setElections] = useState<string[]>([]);
  const [selectedElectionAddr, setSelectedElectionAddr] = useState<string>('');
  const [selectedElection, setSelectedElection] = useState<ElectionDetails | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isOfficer, setIsOfficer] = useState<boolean>(false);
  const [showWalletError, setShowWalletError] = useState<boolean>(true);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [citizenStatus, setCitizenStatus] = useState<CitizenStatus>({
    isVerified: false,
    isPending: false,
    isRegistered: false,
    requestId: 0,
    status: 'Pending',
    rejectionReason: ''
  });

  // Sync dismiss state when a new wallet error occurs
  useEffect(() => {
    if (walletError) {
      setShowWalletError(true);
    } else {
      setShowWalletError(false);
    }
  }, [walletError]);

  // Load elections list
  const loadElections = useCallback(async () => {
    if (!isConnected) return;
    const list = await getElectionsList();
    setElections(list);
    
    const params = new URLSearchParams(window.location.search);
    const urlElec = params.get('election');
    if (urlElec && ethers.isAddress(urlElec) && list.some(addr => addr.toLowerCase() === urlElec.toLowerCase())) {
      setSelectedElectionAddr(urlElec);
      setActiveTab('elections');
    } else if (list.length > 0 && !selectedElectionAddr) {
      setSelectedElectionAddr(list[list.length - 1]); // select newest
    }
  }, [isConnected, getElectionsList, selectedElectionAddr]);

  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);

  // Load selected election details
  const loadSelectedElectionDetails = useCallback(async () => {
    if (!selectedElectionAddr) {
      setSelectedElection(null);
      return;
    }
    setIsDetailLoading(true);
    try {
      const details = await getElectionDetails(selectedElectionAddr);
      setSelectedElection(details);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDetailLoading(false);
    }
  }, [selectedElectionAddr, getElectionDetails]);

  // Load citizen status
  const loadCitizenStatus = useCallback(async () => {
    if (!isConnected || !address) return;
    const status = await fetchCitizenStatus(address);
    setCitizenStatus(status);
    if (status.isRegistered || status.isVerified) {
      setIsRegistered(true);
    }
  }, [isConnected, address, fetchCitizenStatus]);

  // Load user status (isRegistered and isOfficer)
  const loadUserStatus = useCallback(async () => {
    if (!isConnected || !address) {
      setIsRegistered(false);
      setIsOfficer(false);
      return;
    }

    const [regStatus, officerStatus] = await Promise.all([
      isVoterRegistered(address),
      isUserCommissionOfficer(),
      loadCitizenStatus()
    ]);

    setIsRegistered(regStatus);
    setIsOfficer(officerStatus || address.toLowerCase() === '0x36e1C1EbC3e36d9b55E4b872A74B6F059008789e'.toLowerCase());
  }, [isConnected, address, isVoterRegistered, isUserCommissionOfficer, loadCitizenStatus]);

  // Clear state when disconnected
  useEffect(() => {
    if (!isConnected) {
      setElections([]);
      setSelectedElectionAddr('');
      setSelectedElection(null);
      setIsRegistered(false);
      setIsOfficer(false);
      setActiveTab('landing');
    }
  }, [isConnected]);

  // Redirect away from commission tab if user is not an officer
  useEffect(() => {
    if (!isOfficer && activeTab === 'commission') {
      setActiveTab('register');
    }
  }, [isOfficer, activeTab]);

  // Poll elections, user status, and citizen status every 15 seconds when connected
  useEffect(() => {
    if (!isConnected || !address) return;

    // Load immediately
    loadElections();
    loadUserStatus();

    const interval = setInterval(() => {
      loadElections();
      loadUserStatus();
    }, 15000);

    return () => clearInterval(interval);
  }, [isConnected, address, loadElections, loadUserStatus]);

  // Poll election details occasionally or when tab changes
  useEffect(() => {
    loadSelectedElectionDetails();
  }, [selectedElectionAddr, loadSelectedElectionDetails, activeTab]);

  const handleVoteCast = async (choiceIndex: number) => {
    if (!selectedElectionAddr) return false;
    const success = await castVote(selectedElectionAddr, choiceIndex, encryptChoice);
    if (success) {
      await Promise.all([loadSelectedElectionDetails(), loadUserStatus()]);
    }
    return success;
  };

  const handleReveal = async () => {
    if (!selectedElectionAddr) return false;
    return await requestRevealResults(selectedElectionAddr);
  };

  const handleDecryptFinalize = async () => {
    if (!selectedElectionAddr || !fhevmInstance) return false;
    const success = await decryptAndFinalizeResults(selectedElectionAddr, fhevmInstance);
    if (success) {
      await loadSelectedElectionDetails();
    }
    return success;
  };

  return (
    <div className="min-h-screen bg-[#03000a] flex flex-col font-sans relative">
      {/* Background Decorative Blur Blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-yellow-600/3 rounded-full filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] bg-amber-600/2 rounded-full filter blur-[100px] pointer-events-none" />

      {/* Cryptographic WebAssembly Initializing Overlay Screen */}
      {isConnected && isFheInitializing && !fhevmInstance && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#03000a]/90 backdrop-blur-md px-4">
          <div className="relative flex items-center justify-center mb-6">
            {/* Spinning decorative ring */}
            <div className="absolute w-24 h-24 rounded-full border border-yellow-500/20 border-t-yellow-500 animate-spin" />
            <div className="absolute w-20 h-20 rounded-full border border-amber-500/10 border-b-amber-500 animate-spin [animation-direction:reverse]" />
            <Lock className="h-8 w-8 text-yellow-400 animate-pulse" />
          </div>
          <h2 className="text-2xl font-black font-sans bg-gradient-to-r from-white via-slate-100 to-yellow-300 bg-clip-text text-transparent text-center">
            Initializing FHE WebAssembly
          </h2>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-2.5 text-center max-w-sm leading-relaxed">
            Configuring Web Workers and loading homomorphic encryption params...
          </p>
        </div>
      )}

      <Header
        address={address}
        isConnected={isConnected}
        isOfficer={isOfficer}
        isFheReady={!!fhevmInstance}
        isFheInitializing={isFheInitializing}
        chainId={chainId}
        connectWallet={connect}
        disconnectWallet={disconnect}
        reinitFhe={reinitFhe}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {isConnected && activeTab !== 'landing' ? (
        <main className="flex-1 max-w-none w-full px-8 lg:px-16 py-8">
          {activeTab === 'register' && (
            <IdentityVerification
              citizenStatus={citizenStatus}
              address={address}
              isFheReady={!!fhevmInstance}
              isFheInitializing={isFheInitializing}
              onSubmit={submitIdentityRequest}
              onResubmit={resubmitIdentityRequest}
              onEncrypt={encryptIdentityDocument}
              onRefresh={loadCitizenStatus}
              setActiveTab={setActiveTab}
              fhevmInstance={fhevmInstance}
              decryptIdentityDocument={decryptIdentityDocument}
            />
          )}

          {activeTab === 'elections' && (
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Localized Elections List Sidebar */}
              {elections.length > 0 && (
                <div className="w-full lg:w-80 shrink-0 space-y-4">
                  <div className="glass-panel p-5 space-y-4">
                    <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest block">Available Elections</span>
                    <div className="flex flex-col gap-2.5 max-h-[400px] overflow-y-auto pr-1">
                      {elections.map((addr) => (
                        <button
                          key={addr}
                          onClick={() => setSelectedElectionAddr(addr)}
                          className={`text-left p-3.5 rounded-xl border text-xs transition duration-200 ${
                            selectedElectionAddr === addr
                              ? 'border-yellow-500 bg-yellow-500/5 text-slate-100 font-bold shadow-[0_0_15px_rgba(255,210,8,0.1)]'
                              : 'border-yellow-950/20 hover:border-yellow-500/20 bg-[#070414]/40 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <p className="font-semibold truncate">Address: {addr.substring(0, 10)}...{addr.substring(addr.length - 8)}</p>
                          {selectedElectionAddr === addr && (
                            <span className="text-[10px] text-yellow-400 font-bold block mt-1.5 flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                              Active Selection
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Voting Booth & Results Area */}
              <div className="flex-1 space-y-6">
                {isDetailLoading ? (
                  <div className="glass-panel p-16 text-center flex flex-col items-center justify-center gap-4 bg-slate-900/10">
                    <RefreshCw className="h-8 w-8 text-[#FFD208] animate-spin" />
                    <span className="text-sm text-slate-400 font-semibold tracking-wide">Loading election details...</span>
                  </div>
                ) : selectedElection ? (
                  <>
                    {/* Active Election Header Card */}
                    <div className="glass-panel p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-yellow-500/10 bg-yellow-500/[0.01] mb-6">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-yellow-400 uppercase tracking-widest block">Active Ballot Focus</span>
                        <h2 className="text-xl font-bold text-slate-100">{selectedElection.name}</h2>
                        <p className="text-xs text-slate-400 leading-relaxed max-w-xl">{selectedElection.description}</p>
                      </div>
                      <button
                        onClick={() => setShowShareModal(true)}
                        className="btn-primary py-2 px-5 text-xs font-semibold flex items-center justify-center gap-2 self-start sm:self-auto shrink-0"
                      >
                        <Share2 className="h-4 w-4 text-black" />
                        Share Ballot
                      </button>
                    </div>

                    <VotingBooth
                      election={selectedElection}
                      isRegistered={isRegistered}
                      isFheReady={!!fhevmInstance}
                      onCastVote={handleVoteCast}
                      loading={contractLoading}
                    />

                    <ResultsDashboard
                      election={selectedElection}
                      onRevealResults={handleReveal}
                      onDecryptAndFinalize={handleDecryptFinalize}
                      loading={contractLoading}
                      error={contractError}
                    />
                  </>
                ) : (
                  <div className="glass-panel p-12 text-center text-slate-400 font-medium">
                    No elections deployed yet. Go to the Commission Panel to deploy one.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'voter-status' && (
            <VoterStatus
              address={address}
              isRegistered={isRegistered}
              onCheckStatus={loadUserStatus}
            />
          )}

          {activeTab === 'how-it-works' && (
            <HowItWorks />
          )}

          {activeTab === 'docs' && (
            <Documentation />
          )}

          {activeTab === 'commission' && (
            <CommissionPanel
              isOfficer={isOfficer}
              onRegisterVoter={registerVoter}
              onRegisterVotersBatch={registerVotersBatch}
              onCreateElection={async (name, desc, candNames, candParties, candSymbols, start, end) => {
                const success = await createElection(name, desc, candNames, candParties, candSymbols, start, end);
                if (success) {
                  await loadElections();
                }
                return success;
              }}
              fetchPendingRequests={fetchPendingRequests}
              fetchAllRequests={fetchAllRequests}
              approveIdentityRequest={approveIdentityRequest}
              rejectIdentityRequest={rejectIdentityRequest}
              loading={contractLoading}
              error={contractError}
              fhevmInstance={fhevmInstance}
              decryptIdentityDocument={decryptIdentityDocument}
              appointCommissioner={appointCommissioner}
              delegateRequestAccess={delegateRequestAccess}
              fetchCommissionersList={fetchCommissionersList}
            />
          )}
        </main>
      ) : (
        /* Zama-style Premium Landing Page Hub */
        <main className="flex-1 flex flex-col justify-center py-16 px-8 lg:px-16 max-w-none w-full space-y-24 bg-black relative overflow-hidden">
          
          {/* Live Code Backdrop */}
          <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-[0.03] flex justify-between px-12 z-0">
            <div className="w-1/3 font-mono text-[10px] text-yellow-400 space-y-1 select-none animate-scroll-up">
              {[...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES].map((line, idx) => (
                <div key={idx} className="whitespace-nowrap">{line}</div>
              ))}
            </div>
            <div className="w-1/3 font-mono text-[10px] text-yellow-400 space-y-1 select-none animate-scroll-up [animation-delay:-15s] hidden md:block">
              {[...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES].map((line, idx) => (
                <div key={idx} className="whitespace-nowrap">{line}</div>
              ))}
            </div>
            <div className="w-1/3 font-mono text-[10px] text-yellow-400 space-y-1 select-none animate-scroll-up [animation-delay:-30s] hidden lg:block">
              {[...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES].map((line, idx) => (
                <div key={idx} className="whitespace-nowrap">{line}</div>
              ))}
            </div>
          </div>

          {/* Hero Section */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-16 pt-8 border-b border-slate-950 pb-16 relative z-10">
            <div className="space-y-6 max-w-3xl text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-yellow-500/20 bg-yellow-500/5 text-xs font-mono font-bold text-[#FFD208] uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" />
                Fully Homomorphic Encryption (FHE)
              </div>
              
              <h1 className="text-5xl font-black tracking-tight sm:text-7xl font-sans text-white leading-none">
                BUILD <span className="text-[#FFD208]">CONFIDENTIAL</span> ELECTIONS
              </h1>
              
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-medium max-w-2xl">
                CipherBallot is a next-generation decentralized election system powered by Zama's FHEVM. It allows voting ballots to remain cryptographically sealed during computation, ensuring absolute privacy while remaining fully verifiable on-chain.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <button
                  onClick={() => {
                    if (isConnected) {
                      setActiveTab('register');
                    } else {
                      connect();
                      setActiveTab('register');
                    }
                  }}
                  className="bg-[#FFD208] text-black font-extrabold text-xs uppercase tracking-wider px-6 py-3.5 rounded hover:bg-yellow-400 transition-colors duration-200 flex items-center gap-2"
                >
                  Get Started <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setActiveTab('how-it-works');
                    if (!isConnected) {
                      connect();
                    }
                  }}
                  className="bg-transparent text-slate-300 border border-slate-800 font-extrabold text-xs uppercase tracking-wider px-6 py-3.5 rounded hover:text-white hover:border-yellow-500/30 transition-all duration-200"
                >
                  Discover How It Works
                </button>
              </div>
            </div>

            {/* Glowing Cryptographic Shield Graphic */}
            <div className="relative flex h-80 w-80 items-center justify-center shrink-0 z-10">
              <div className="absolute inset-0 rounded-full bg-yellow-500/5 blur-3xl" />
              {/* Outer thin grid lines */}
              <div className="absolute w-72 h-72 rounded-full border border-yellow-500/5 animate-spin [animation-duration:30s]" />
              <div className="absolute w-60 h-60 rounded-full border border-slate-900 animate-spin [animation-direction:reverse] [animation-duration:20s]" />
              <div className="absolute w-48 h-48 rounded-full border border-yellow-500/10" />
              
              {/* Core Shield */}
              <div className="z-10 flex h-36 w-36 items-center justify-center rounded-2xl bg-black border border-slate-900 hover:border-yellow-500/30 shadow-2xl transition duration-300">
                <Lock className="h-14 w-14 text-[#FFD208]" />
              </div>
            </div>
          </div>

          {/* Live Network Stats Dashboard */}
          <div className="grid gap-6 grid-cols-2 lg:grid-cols-4 relative z-10 border-b border-slate-955 pb-16">
            {[
              { label: "Network Status", val: "Connected (Sepolia)" },
              { label: "FHE Engine", val: "Zama fhEVM v2.0" },
              { label: "MPC Threshold", val: "5 / 7 Quorum" },
              { label: "Gas Limit per Tx", val: "10,000,000" }
            ].map((stat, i) => (
              <div key={i} className="bg-[#030305] border border-slate-950 p-6 rounded-lg text-left space-y-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">{stat.label}</span>
                <p className="text-sm font-black text-slate-200">{stat.val}</p>
              </div>
            ))}
          </div>

          {/* Interactive Code / FHEVM Core Mechanic Section */}
          <div className="grid gap-16 lg:grid-cols-2 items-center border-b border-slate-955 pb-16 relative z-10">
            <div className="space-y-6 text-left">
              <span className="text-[10px] font-bold text-[#FFD208] uppercase tracking-widest font-mono">Core FHE VM Primitive</span>
              <h2 className="text-3xl font-black text-white leading-tight">
                COMPUTE DIRECTLY ON ENCRYPTED DATA
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">
                Traditional encryption requires you to decrypt data before doing any arithmetic operations. FHEVM allows smart contracts to perform comparisons and additions directly on the ciphertexts.
              </p>
              <ul className="space-y-3 font-mono text-[11px] text-slate-300">
                <li className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FFD208]" />
                  <code>FHE.eq()</code> — Encrypted comparison (returns ebool)
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FFD208]" />
                  <code>FHE.select()</code> — Encrypted conditional selector
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FFD208]" />
                  <code>FHE.add()</code> — Encrypted addition tallying
                </li>
              </ul>
            </div>

            {/* Simulated Code Block Panel */}
            <div className="bg-[#030305] border border-slate-950 rounded-xl p-6 font-mono text-left text-xs leading-relaxed shadow-2xl overflow-x-auto">
              <div className="flex items-center gap-1.5 mb-4 border-b border-slate-955 pb-3">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-slate-500 ml-2">Election.sol</span>
              </div>
              <pre className="text-slate-300 space-y-1 text-[11px]">
                <div><span className="text-slate-500">// 1. Retrieve encrypted choice from user</span></div>
                <div><span className="text-[#FFD208]">euint8</span> choice = FHE.fromExternal(encryptedChoice, proof);</div>
                <br />
                <div><span className="text-slate-500">// 2. Homomorphically tally votes</span></div>
                <div><span className="text-[#c084fc]">for</span> (<span className="text-[#c084fc]">uint8</span> i = 0; i &lt; candidateCount; i++) &#123;</div>
                <div>  <span className="text-slate-500">  // Is this candidate chosen? (ebool)</span></div>
                <div>  <span className="text-[#FFD208]">ebool</span> isChosen = FHE.eq(choice, FHE.asEuint8(i));</div>
                <div>  <span className="text-slate-500">  // Select 1 if true, 0 if false</span></div>
                <div>  <span className="text-[#FFD208]">euint32</span> inc = FHE.select(isChosen, FHE.asEuint32(1), FHE.asEuint32(0));</div>
                <div>  <span className="text-slate-500">  // Add to running tally (still encrypted)</span></div>
                <div>  encryptedTallies[i] = FHE.add(encryptedTallies[i], inc);</div>
                <div>&#125;</div>
              </pre>
            </div>
          </div>

          {/* Cryptographic Protocol Flowchart */}
          <div className="space-y-8 border-b border-slate-955 pb-16 relative z-10 text-left">
            <div className="text-center max-w-lg mx-auto space-y-2">
              <span className="text-[10px] font-bold text-[#FFD208] uppercase tracking-widest font-mono">Process Pipeline</span>
              <h2 className="text-3xl font-black text-white">THE CRYPTOGRAPHIC FLOW</h2>
              <p className="text-xs text-slate-500 font-medium">How CipherBallot processes your identity and ballot end-to-end.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
              {[
                { title: "1. Identity Seal", desc: "Citizen details are encrypted locally using Zama Wasm SDK before submission." },
                { title: "2. Whitelisting", desc: "Commissioner reviews and approves the FHE-allowed document on-chain." },
                { title: "3. Shielded Vote", desc: "Ballots are cast as encrypted indexes, tallied homomorphically on-chain." },
                { title: "4. MPC Decryption", desc: "KMS MPC nodes decrypt only the final sums, leaving ballots hidden forever." }
              ].map((step, idx) => (
                <div key={idx} className="bg-[#030305] border border-slate-950 p-6 rounded-lg space-y-3 relative">
                  <div className="absolute -top-3 -left-3 h-7 w-7 rounded-full bg-[#FFD208] text-black font-black flex items-center justify-center text-xs">
                    {idx + 1}
                  </div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wide pt-2">{step.title}</h4>
                  <p className="text-[11px] text-slate-550 leading-relaxed font-medium">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Guarantees Grid */}
          <div className="space-y-8 relative z-10">
            <div className="text-center max-w-lg mx-auto space-y-2">
              <span className="text-[10px] font-bold text-[#FFD208] uppercase tracking-widest font-mono">Security Guarantees</span>
              <h2 className="text-3xl font-black text-white">WHY CIPHERBALLOT?</h2>
              <p className="text-xs text-slate-500 font-medium">CipherBallot guarantees trust in every single ballot, preserving anonymity.</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-black border border-slate-950 hover:border-[#FFD208]/20 p-6 rounded transition duration-200 text-left space-y-4">
                <div className="h-10 w-10 flex items-center justify-center rounded bg-yellow-500/5 border border-yellow-500/10 text-[#FFD208]">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">End-to-End Encryption</h3>
                <p className="text-[11px] text-slate-550 leading-relaxed font-medium">
                  Your votes and identity details are encrypted client-side. No plain text data is ever leaked to the network.
                </p>
              </div>

              <div className="bg-black border border-slate-955 hover:border-[#FFD208]/20 p-6 rounded transition duration-200 text-left space-y-4">
                <div className="h-10 w-10 flex items-center justify-center rounded bg-yellow-500/5 border border-yellow-500/10 text-[#FFD208]">
                  <EyeOff className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Voter Privacy</h3>
                <p className="text-[11px] text-slate-550 leading-relaxed font-medium">
                  Mathematical computations happen directly on the encrypted tallies. Nobody sees the intermediate votes.
                </p>
              </div>

              <div className="bg-black border border-slate-955 hover:border-[#FFD208]/20 p-6 rounded transition duration-200 text-left space-y-4">
                <div className="h-10 w-10 flex items-center justify-center rounded bg-yellow-500/5 border border-yellow-500/10 text-[#FFD208]">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">On-Chain Verifiability</h3>
                <p className="text-[11px] text-slate-550 leading-relaxed font-medium">
                  Verification happens publically on-chain using threshold KMS signatures to unlock the audited results.
                </p>
              </div>

              <div className="bg-black border border-slate-955 hover:border-[#FFD208]/20 p-6 rounded transition duration-200 text-left space-y-4">
                <div className="h-10 w-10 flex items-center justify-center rounded bg-yellow-500/5 border border-yellow-500/10 text-[#FFD208]">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Sybil Protection</h3>
                <p className="text-[11px] text-slate-550 leading-relaxed font-medium">
                  Government document hashes ensure single-vote compliance without storing your cleartext records.
                </p>
              </div>
            </div>
          </div>

          {/* Simulated Audit Ledger Feed */}
          <div className="space-y-8 border-t border-slate-955 pt-16 relative z-10">
            <div className="text-center max-w-lg mx-auto space-y-2">
              <span className="text-[10px] font-bold text-[#FFD208] uppercase tracking-widest font-mono">Live Audit Feed</span>
              <h2 className="text-3xl font-black text-white">CRYPTOGRAPHIC LEDGER</h2>
              <p className="text-xs text-slate-500 font-medium">Real-time audit trail of zero-knowledge & homomorphic transactions.</p>
            </div>

            <div className="bg-[#030305] border border-slate-950 rounded-xl overflow-hidden shadow-2xl font-mono text-xs text-left">
              {/* Terminal Header */}
              <div className="bg-slate-950 border-b border-slate-955 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-yellow-500/30 animate-pulse" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">sepolia-ledger-feed.sh</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                  LIVE SYNCING
                </span>
              </div>
              
              {/* Ledger Table */}
              <div className="divide-y divide-slate-955 max-h-[300px] overflow-y-auto pr-1">
                {[
                  { tx: "0x8f3c...9a2f", type: "Cast Shielded Ballot", cipher: "euint8(0x7f4c93...)", gas: "142,504", status: "Success", age: "12s ago" },
                  { tx: "0x3da2...5b8c", type: "Register FHE Identity", cipher: "euint256(0x9d2ea...)", gas: "328,190", status: "Success", age: "1m ago" },
                  { tx: "0x12c4...e3da", type: "Approve Voter Status", cipher: "delegateRequestAccess()", gas: "84,921", status: "Success", age: "3m ago" },
                  { tx: "0x7b1a...f2e5", type: "Cast Shielded Ballot", cipher: "euint8(0x1a8f9c...)", gas: "142,504", status: "Success", age: "5m ago" },
                  { tx: "0x9fe2...6b7d", type: "Request KMS Decryption", cipher: "revealResultCallback()", gas: "195,432", status: "Success", age: "8m ago" }
                ].map((item, idx) => (
                  <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-950/40 transition">
                    <div className="flex items-center gap-4">
                      <span className="text-slate-500 font-bold">TX</span>
                      <span className="text-yellow-400 font-bold select-all">{item.tx}</span>
                      <span className="text-slate-300 font-semibold uppercase text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                        {item.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-6 text-slate-400 text-[11px] self-start md:self-auto">
                      <div>
                        <span className="text-slate-600">Payload: </span>
                        <span className="text-slate-300 font-bold select-all">{item.cipher}</span>
                      </div>
                      <div>
                        <span className="text-slate-600">Gas: </span>
                        <span className="text-slate-300">{item.gas}</span>
                      </div>
                      <span className="text-slate-500 font-semibold">{item.age}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Wallet Error Alert Banner */}
          {walletError && showWalletError && (
            <div className="max-w-md mx-auto bg-rose-500/10 border border-rose-500/20 rounded p-4 text-xs text-rose-400 font-semibold flex items-center justify-between gap-3 shadow-lg font-mono relative z-10">
              <span className="leading-relaxed">{walletError}</span>
              <button
                onClick={() => setShowWalletError(false)}
                className="text-rose-400 hover:text-rose-200 transition p-1 hover:bg-rose-500/10 rounded shrink-0"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </main>
      )}

      {/* Share Card Modal */}
      {showShareModal && selectedElection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b0f] border border-yellow-500/20 rounded-2xl p-6 max-w-md w-full relative space-y-4 shadow-2xl">
            <button
              onClick={() => setShowShareModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-250 transition p-1 hover:bg-slate-900 rounded-lg"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-100">Share Ballot Card</h3>
              <p className="text-[11px] text-slate-400">Generate a high-definition download card or copy the direct voting URL.</p>
            </div>
            <div className="pt-2">
              <ElectionShareCard
                election={selectedElection}
                electionAddress={selectedElectionAddr}
              />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-yellow-500/10 bg-[#060608] py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-tr from-[#FFD208] to-[#FF9F00]">
              <span className="text-[10px] font-black text-black">CB</span>
            </div>
            <span className="text-xs font-bold tracking-wider text-slate-200">
              CipherBallot
            </span>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-400">
            <button 
              onClick={() => {
                setActiveTab('docs');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-[#FFD208] transition duration-150"
            >
              Documents
            </button>
            <a 
              href="https://github.com/shuhaib90/cipherballot" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-[#FFD208] transition duration-150 flex items-center gap-1"
            >
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
            <a 
              href="https://linkedin.com/in/shuhaib90" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-[#FFD208] transition duration-150 flex items-center gap-1"
            >
              <Linkedin className="h-3.5 w-3.5" /> Founder's LinkedIn
            </a>
            <a 
              href="https://x.com/shuhaib90" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-[#FFD208] transition duration-150 flex items-center gap-1"
            >
              <Twitter className="h-3.5 w-3.5" /> X
            </a>
          </div>

          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
            © 2026 CipherBallot. Math-enforced privacy.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
