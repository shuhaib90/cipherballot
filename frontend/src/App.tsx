import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { VoterStatus } from './components/VoterStatus';
import { VotingBooth } from './components/VotingBooth';
import { ResultsDashboard } from './components/ResultsDashboard';
import { CommissionPanel } from './components/CommissionPanel';
import { IdentityVerification } from './components/IdentityVerification';
import { HowItWorks } from './components/HowItWorks';
import { useWallet } from './hooks/useWallet';
import { useFhevm } from './hooks/useFhevm';
import { useContract, type ElectionDetails } from './hooks/useContract';
import { Shield, X, ShieldCheck, RefreshCw, Lock, Cpu, EyeOff, ShieldAlert, ArrowRight } from 'lucide-react';
import type { CitizenStatus } from './utils/types';

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

  const [activeTab, setActiveTab] = useState<'register' | 'elections' | 'voter-status' | 'commission' | 'how-it-works'>('register');
  const [elections, setElections] = useState<string[]>([]);
  const [selectedElectionAddr, setSelectedElectionAddr] = useState<string>('');
  const [selectedElection, setSelectedElection] = useState<ElectionDetails | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isOfficer, setIsOfficer] = useState<boolean>(false);
  const [showWalletError, setShowWalletError] = useState<boolean>(true);
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
    if (list.length > 0 && !selectedElectionAddr) {
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
      setActiveTab('register');
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

      {isConnected ? (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
                    <div className="flex flex-col gap-2.5 max-h-[500px] overflow-y-auto pr-1">
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
        /* Premium Connected Landing Page Hub (JumpBot style) */
        <main className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
          
          {/* Hero Section */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12 pt-8">
            <div className="space-y-6 max-w-2xl text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-yellow-500/20 bg-yellow-500/5 text-xs font-bold text-[#FFD208] shadow-md">
                <ShieldCheck className="h-3.5 w-3.5" />
                Fully Homomorphic Encryption (FHE)
              </div>
              
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl font-sans text-slate-100 leading-[1.1]">
                Unleashing the Power of <span className="bg-gradient-to-r from-[#FFD208] via-yellow-300 to-amber-400 bg-clip-text text-transparent">Confidential Voting</span>
              </h1>
              
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-medium">
                CipherBallot is a next-generation decentralized election system. Powered by Zama's FHEVM, 
                it allows your voting ballots to remain cryptographically sealed during computation, ensuring 
                absolute privacy while remaining fully verifiable on-chain.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={connect}
                  className="btn-primary"
                >
                  Get Started <ArrowRight className="h-4.5 w-4.5" />
                </button>
                <button
                  onClick={() => {
                    // Temporarily set connected state to simulate showing how it works even before connect
                    setActiveTab('how-it-works');
                    connect(); // Trigger connect too
                  }}
                  className="btn-secondary"
                >
                  Discover How It Works
                </button>
              </div>
            </div>

            {/* Glowing Shield Graphic Overlay */}
            <div className="relative flex h-80 w-80 items-center justify-center shrink-0">
              {/* Outer decorative glowing ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-yellow-500/10 to-amber-500/10 blur-xl animate-pulse-slow" />
              <div className="absolute w-72 h-72 rounded-full border border-yellow-500/10 animate-spin [animation-duration:15s]" />
              <div className="absolute w-60 h-60 rounded-full border border-amber-500/5 animate-spin [animation-direction:reverse] [animation-duration:10s]" />
              
              {/* Core Shield */}
              <div className="z-10 flex h-40 w-40 items-center justify-center rounded-3xl bg-slate-950 border border-yellow-500/20 shadow-2xl shadow-yellow-500/10">
                <Shield className="h-16 w-16 text-[#FFD208] animate-float" />
              </div>
            </div>
          </div>

          {/* Core Feature Value Cards */}
          <div className="space-y-6">
            <div className="text-center max-w-lg mx-auto space-y-2">
              <h2 className="text-2xl font-extrabold text-slate-100">Why CipherBallot?</h2>
              <p className="text-xs text-slate-400 font-medium">CipherBallot guarantees trust in every single ballot, preserving anonymity.</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="glow-card">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-yellow-500/10 border border-yellow-500/20 mb-4 text-yellow-400">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-100 mb-1.5">End-to-End Encryption</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Your votes and identity details are encrypted client-side. No plain text data is ever leaked.
                </p>
              </div>

              <div className="glow-card">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4 text-amber-400">
                  <EyeOff className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-100 mb-1.5">Voter Privacy</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Mathematical computations happen directly on the encrypted tallies. Nobody sees the intermediate votes.
                </p>
              </div>

              <div className="glow-card">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 mb-4 text-purple-400">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-100 mb-1.5">On-Chain Verifiability</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Verification happens publically on-chain using threshold KMS signatures to unlock the audited results.
                </p>
              </div>

              <div className="glow-card">
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 mb-4 text-emerald-400">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold text-slate-100 mb-1.5">Sybil Protection</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Government document hashes ensure single-vote compliance without storing your cleartext records.
                </p>
              </div>
            </div>
          </div>

          {/* Wallet Error Alert Banner */}
          {walletError && showWalletError && (
            <div className="max-w-md mx-auto bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-xs text-rose-400 font-semibold flex items-center justify-between gap-3 shadow-lg">
              <span className="leading-relaxed">{walletError}</span>
              <button
                onClick={() => setShowWalletError(false)}
                className="text-rose-400 hover:text-rose-200 transition p-1 hover:bg-rose-500/10 rounded-lg shrink-0"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-yellow-500/5 bg-black py-6 text-center text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-auto">
        CipherBallot © 2026. Powered by Zama FHEVM public decryption.
      </footer>
    </div>
  );
}

export default App;
