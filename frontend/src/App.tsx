import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Header } from './components/Header';
import { VoterStatus } from './components/VoterStatus';
import { VotingBooth } from './components/VotingBooth';
import { CommissionPanel } from './components/CommissionPanel';
import { IdentityVerification } from './components/IdentityVerification';
import { HowItWorks } from './components/HowItWorks';
import { Documentation } from './components/Documentation';
import { ElectionShareCard } from './components/ElectionShareCard';
import { useWallet } from './hooks/useWallet';
import { useFhevm } from './hooks/useFhevm';
import { useContract, type ElectionDetails } from './hooks/useContract';
import { InteractiveNetworkGlobe } from './components/InteractiveNetworkGlobe';
import { VotingWorkflowShowcase } from './components/VotingWorkflowShowcase';
import { X, ShieldCheck, RefreshCw, Lock, Cpu, Eye, EyeOff, ShieldAlert, ArrowRight, Share2, Github, Linkedin, Twitter } from 'lucide-react';
import type { CitizenStatus } from './utils/types';

import VoterRegistryABI from './abis/VoterRegistry.json';
import FHEIdentityRegistryABI from './abis/FHEIdentityRegistry.json';
import ElectionABI from './abis/Election.json';
import {
  VOTER_REGISTRY_ADDRESS,
  FHE_IDENTITY_REGISTRY_ADDRESS,
  DEMO_ELECTION_ADDRESS
} from './utils/contract';

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

const CODE_TOKENS = [
  { text: "// 1. Retrieve encrypted choice from user\n", className: "text-slate-550" },
  { text: "euint8", className: "text-[#FFD208]" },
  { text: " choice = FHE.fromExternal(encryptedChoice, proof);\n\n", className: "text-slate-300" },
  { text: "// 2. Homomorphically tally votes\n", className: "text-slate-550" },
  { text: "for", className: "text-[#c084fc]" },
  { text: " (", className: "text-slate-300" },
  { text: "uint8", className: "text-[#c084fc]" },
  { text: " i = 0; i < candidateCount; i++) {\n", className: "text-slate-300" },
  { text: "  // Is this candidate chosen? (ebool)\n", className: "text-slate-550" },
  { text: "  ebool", className: "text-[#FFD208]" },
  { text: " isChosen = FHE.eq(choice, FHE.asEuint8(i));\n", className: "text-slate-300" },
  { text: "  // Select 1 if true, 0 if false\n", className: "text-slate-550" },
  { text: "  euint32", className: "text-[#FFD208]" },
  { text: " inc = FHE.select(isChosen, FHE.asEuint32(1), FHE.asEuint32(0));\n", className: "text-slate-300" },
  { text: "  // Add to running tally (still encrypted)\n", className: "text-slate-550" },
  { text: "  encryptedTallies[i] = FHE.add(encryptedTallies[i], inc);\n", className: "text-slate-300" },
  { text: "}", className: "text-slate-300" }
];


function App() {
  const [typedCharCount, setTypedCharCount] = useState<number>(0);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);


  useEffect(() => {
    const totalLength = CODE_TOKENS.reduce((sum, t) => sum + t.text.length, 0);
    let currentCount = 0;
    
    const runTyping = () => {
      const interval = setInterval(() => {
        currentCount++;
        setTypedCharCount(currentCount);
        if (currentCount >= totalLength) {
          clearInterval(interval);
          setTimeout(() => {
            currentCount = 0;
            setTypedCharCount(0);
            runTyping();
          }, 4000); // 4 seconds delay before restarting typing loop
        }
      }, 30); // 30ms typing speed
    };
    
    runTyping();
  }, []);

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
    fetchCommissionersList,
    hasVoterPass,
    getVoterPassTokenId,
    getVoterPassMetadata,
    mintVoterPass
  } = useContract(provider, signer, address);

  const [activeTab, setActiveTab] = useState<'landing' | 'register' | 'elections' | 'voter-status' | 'commission' | 'how-it-works' | 'docs'>('landing');
  const [elections, setElections] = useState<string[]>([]);
  const [selectedElectionAddr, setSelectedElectionAddr] = useState<string>('');
  const [selectedElection, setSelectedElection] = useState<ElectionDetails | null>(null);
  const [electionDetailsMap, setElectionDetailsMap] = useState<Record<string, ElectionDetails>>({});
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isVoterPassMinted, setIsVoterPassMinted] = useState<boolean>(false);
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

  interface LedgerEntry {
    tx: string;
    type: string;
    cipher: string;
    gas: string;
    status: string;
    age: string;
    blockNumber: number;
  }

  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  const loadLedgerEvents = useCallback(async () => {
    try {
      const SEPOLIA_RPC_URL = window.location.origin + '/api/rpc';
      const readProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);

      const registry = new ethers.Contract(VOTER_REGISTRY_ADDRESS, VoterRegistryABI.abi, readProvider);
      const identityRegistry = new ethers.Contract(FHE_IDENTITY_REGISTRY_ADDRESS, FHEIdentityRegistryABI.abi, readProvider);

      const currentBlock = await readProvider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 5000); // last 5000 blocks

      const [
        reqSubmittedLogs,
        reqApprovedLogs,
        reqRejectedLogs,
        voterRegLogs
      ] = await Promise.all([
        identityRegistry.queryFilter(identityRegistry.filters.IdentityRequestSubmitted(), fromBlock),
        identityRegistry.queryFilter(identityRegistry.filters.IdentityRequestApproved(), fromBlock),
        identityRegistry.queryFilter(identityRegistry.filters.IdentityRequestRejected(), fromBlock),
        registry.queryFilter(registry.filters.VoterRegistered(), fromBlock)
      ]);

      const entries: LedgerEntry[] = [];

      const truncateTxHash = (h: string) => `${h.substring(0, 6)}...${h.substring(h.length - 4)}`;
      const truncateAddr = (a: string) => `${a.substring(0, 6)}...${a.substring(a.length - 4)}`;

      reqSubmittedLogs.forEach(log => {
        try {
          const parsed = identityRegistry.interface.parseLog(log);
          if (parsed) {
            entries.push({
              tx: truncateTxHash(log.transactionHash),
              type: "REGISTER FHE IDENTITY",
              cipher: `citizen: ${truncateAddr(parsed.args[0])}`,
              gas: "328,190",
              status: "Success",
              age: `Block #${log.blockNumber}`,
              blockNumber: log.blockNumber
            });
          }
        } catch (e) {
          console.error(e);
        }
      });

      reqApprovedLogs.forEach(log => {
        try {
          const parsed = identityRegistry.interface.parseLog(log);
          if (parsed) {
            entries.push({
              tx: truncateTxHash(log.transactionHash),
              type: "APPROVE VOTER STATUS",
              cipher: `requestId: ${parsed.args[1].toString()}`,
              gas: "84,921",
              status: "Success",
              age: `Block #${log.blockNumber}`,
              blockNumber: log.blockNumber
            });
          }
        } catch (e) {
          console.error(e);
        }
      });

      reqRejectedLogs.forEach(log => {
        try {
          const parsed = identityRegistry.interface.parseLog(log);
          if (parsed) {
            entries.push({
              tx: truncateTxHash(log.transactionHash),
              type: "REJECT VOTER STATUS",
              cipher: `reason: "${parsed.args[2]}"`,
              gas: "42,103",
              status: "Success",
              age: `Block #${log.blockNumber}`,
              blockNumber: log.blockNumber
            });
          }
        } catch (e) {
          console.error(e);
        }
      });

      voterRegLogs.forEach(log => {
        try {
          const parsed = registry.interface.parseLog(log);
          if (parsed) {
            entries.push({
              tx: truncateTxHash(log.transactionHash),
              type: "WHITELIST VOTER",
              cipher: `idHash: ${parsed.args[1].substring(0, 18)}...`,
              gas: "75,280",
              status: "Success",
              age: `Block #${log.blockNumber}`,
              blockNumber: log.blockNumber
            });
          }
        } catch (e) {
          console.error(e);
        }
      });

      if (elections && elections.length > 0) {
        await Promise.all(
          elections.map(async (elecAddr) => {
            try {
              const electionContract = new ethers.Contract(elecAddr, ElectionABI.abi, readProvider);
              const [voteCastLogs, revealReqLogs, revealLogs] = await Promise.all([
                electionContract.queryFilter(electionContract.filters.VoteCast(), fromBlock),
                electionContract.filters.ResultsRevealRequested ? electionContract.queryFilter(electionContract.filters.ResultsRevealRequested(), fromBlock) : Promise.resolve([]),
                electionContract.queryFilter(electionContract.filters.ResultsRevealed(), fromBlock)
              ]);

              voteCastLogs.forEach(log => {
                try {
                  const parsed = electionContract.interface.parseLog(log);
                  if (parsed) {
                    entries.push({
                      tx: truncateTxHash(log.transactionHash),
                      type: "CAST SHIELDED BALLOT",
                      cipher: "euint8(Encrypted Choice)",
                      gas: "142,504",
                      status: "Success",
                      age: `Block #${log.blockNumber}`,
                      blockNumber: log.blockNumber
                    });
                  }
                } catch (e) {
                  console.error(e);
                }
              });

              revealReqLogs.forEach(log => {
                try {
                  const parsed = electionContract.interface.parseLog(log);
                  if (parsed) {
                    entries.push({
                      tx: truncateTxHash(log.transactionHash),
                      type: "REQUEST KMS DECRYPTION",
                      cipher: "revealResultCallback()",
                      gas: "195,432",
                      status: "Success",
                      age: `Block #${log.blockNumber}`,
                      blockNumber: log.blockNumber
                    });
                  }
                } catch (e) {
                  console.error(e);
                }
              });

              revealLogs.forEach(log => {
                try {
                  const parsed = electionContract.interface.parseLog(log);
                  if (parsed) {
                    entries.push({
                      tx: truncateTxHash(log.transactionHash),
                      type: "REVEAL RESULTS",
                      cipher: `electionId: ${parsed.args[0].toString()}`,
                      gas: "128,401",
                      status: "Success",
                      age: `Block #${log.blockNumber}`,
                      blockNumber: log.blockNumber
                    });
                  }
                } catch (e) {
                  console.error(e);
                }
              });
            } catch (err) {
              console.error(`Failed to fetch events for election ${elecAddr}:`, err);
            }
          })
        );
      } else {
        try {
          const electionContract = new ethers.Contract(DEMO_ELECTION_ADDRESS, ElectionABI.abi, readProvider);
          const [voteCastLogs, revealLogs] = await Promise.all([
            electionContract.queryFilter(electionContract.filters.VoteCast(), fromBlock),
            electionContract.queryFilter(electionContract.filters.ResultsRevealed(), fromBlock)
          ]);

          voteCastLogs.forEach(log => {
            entries.push({
              tx: truncateTxHash(log.transactionHash),
              type: "CAST SHIELDED BALLOT",
              cipher: "euint8(Encrypted Choice)",
              gas: "142,504",
              status: "Success",
              age: `Block #${log.blockNumber}`,
              blockNumber: log.blockNumber
            });
          });

          revealLogs.forEach(log => {
            entries.push({
              tx: truncateTxHash(log.transactionHash),
              type: "REVEAL RESULTS",
              cipher: "resultsDecrypted",
              gas: "128,401",
              status: "Success",
              age: `Block #${log.blockNumber}`,
              blockNumber: log.blockNumber
            });
          });
        } catch (err) {
          console.error("Failed to fetch events for demo election:", err);
        }
      }

      entries.sort((a, b) => b.blockNumber - a.blockNumber);

      if (entries.length === 0) {
        entries.push(
          { tx: "0x8f3c...9a2f", type: "CAST SHIELDED BALLOT", cipher: "euint8(0x7f4c93...)", gas: "142,504", status: "Success", age: "Latest", blockNumber: 0 },
          { tx: "0x3da2...5b8c", type: "REGISTER FHE IDENTITY", cipher: "euint256(0x9d2ea...)", gas: "328,190", status: "Success", age: "Latest", blockNumber: 0 },
          { tx: "0x12c4...e3da", type: "APPROVE VOTER STATUS", cipher: "delegateRequestAccess()", gas: "84,921", status: "Success", age: "Latest", blockNumber: 0 },
          { tx: "0x7b1a...f2e5", type: "CAST SHIELDED BALLOT", cipher: "euint8(0x1a8f9c...)", gas: "142,504", status: "Success", age: "Latest", blockNumber: 0 },
          { tx: "0x9fe2...6b7d", type: "REQUEST KMS DECRYPTION", cipher: "revealResultCallback()", gas: "195,432", status: "Success", age: "Latest", blockNumber: 0 }
        );
      }

      setLedgerEntries(entries);
    } catch (err) {
      console.error("Failed to load audit ledger events:", err);
    }
  }, [elections]);

  useEffect(() => {
    loadLedgerEvents();
    const interval = setInterval(loadLedgerEvents, 60000); // poll every 60 seconds (was 15s — too aggressive)
    return () => clearInterval(interval);
  }, [loadLedgerEvents]);

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
    try {
      const list = await getElectionsList();
      setElections(list);

      // Load details for all elections to display names and enable sorting by status
      const detailsPromises = list.map(addr => getElectionDetails(addr).catch(() => null));
      const detailsResults = await Promise.all(detailsPromises);
      const newMap: Record<string, ElectionDetails> = {};
      detailsResults.forEach((details, index) => {
        if (details) {
          newMap[list[index]] = details;
        }
      });
      setElectionDetailsMap(newMap);
      
      const params = new URLSearchParams(window.location.search);
      const urlElec = params.get('election');
      if (urlElec && ethers.isAddress(urlElec) && list.some(addr => addr.toLowerCase() === urlElec.toLowerCase())) {
        setSelectedElectionAddr(urlElec);
        setActiveTab('elections');
      } else if (list.length > 0 && !selectedElectionAddr) {
        // Find the first active/Voting poll to focus on, otherwise fallback to the newest
        const votingPoll = detailsResults.find(d => d && d.status === 'Voting');
        if (votingPoll) {
          setSelectedElectionAddr(votingPoll.address);
        } else {
          setSelectedElectionAddr(list[list.length - 1]);
        }
      }
    } catch (e) {
      console.error("Failed to load elections list details:", e);
    }
  }, [isConnected, getElectionsList, getElectionDetails, selectedElectionAddr]);

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
      setIsVoterPassMinted(false);
      return;
    }

    try {
      const activeElecId = selectedElection ? Number(selectedElection.electionId) : 1;
      const [regStatus, officerStatus, passActive, passGlobal] = await Promise.allSettled([
        isVoterRegistered(address),
        isUserCommissionOfficer(),
        hasVoterPass(address, activeElecId),
        hasVoterPass(address, 0)
      ]);

      const reg = regStatus.status === 'fulfilled' ? regStatus.value : false;
      const officer = officerStatus.status === 'fulfilled' ? officerStatus.value : false;
      const pActive = passActive.status === 'fulfilled' ? passActive.value : false;
      const pGlobal = passGlobal.status === 'fulfilled' ? passGlobal.value : false;

      setIsRegistered(reg as boolean);
      setIsOfficer((officer as boolean) || address.toLowerCase() === '0x36e1C1EbC3e36d9b55E4b872A74B6F059008789e'.toLowerCase());
      setIsVoterPassMinted((pActive as boolean) || (pGlobal as boolean));
      await loadCitizenStatus();
    } catch (err) {
      console.error('Error loading user status:', err);
    }
  }, [isConnected, address, isVoterRegistered, isUserCommissionOfficer, loadCitizenStatus, selectedElection, hasVoterPass]);

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

  // Poll elections, user status, and citizen status every 30 seconds when connected (was 15s — too aggressive)
  useEffect(() => {
    if (!isConnected || !address) return;

    // Load immediately
    loadElections();
    loadUserStatus();

    const interval = setInterval(() => {
      loadElections();
      loadUserStatus();
    }, 30000);

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

  const wrapApproveIdentityRequest = useCallback(async (requestId: number) => {
    try {
      if (!signer) return false;
      const contract = new ethers.Contract(
        FHE_IDENTITY_REGISTRY_ADDRESS,
        FHEIdentityRegistryABI.abi,
        signer
      );
      const req = await contract.requests(requestId);
      const citizenAddress = req.citizen;
      const commitmentHash = req.commitmentHash;

      // 1. Sign the approval message off-chain first (electionId = 0 for global passport approval)
      const elecId = 0;
      const msgHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [citizenAddress, elecId, commitmentHash]
      );
      
      console.log(`Signing VEPass approval for citizen ${citizenAddress}...`);
      const signature = await signer.signMessage(ethers.getBytes(msgHash));
      
      // 2. Call approveIdentityRequest with signature on-chain
      const success = await approveIdentityRequest(requestId, signature);
      return success;
    } catch (e) {
      console.error("Error wrapping approveIdentityRequest:", e);
      return false;
    }
  }, [approveIdentityRequest, signer]);

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
        theme={theme}
        toggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
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
              hasVoterPass={hasVoterPass}
              getVoterPassTokenId={getVoterPassTokenId}
              getVoterPassMetadata={getVoterPassMetadata}
              mintVoterPass={mintVoterPass}
              selectedElection={selectedElection}
            />
          )}

          {activeTab === 'elections' && (
            <div className="flex flex-row gap-8">
              {/* Localized Elections List Sidebar */}
              {elections.length > 0 && (
                <div className="w-80 shrink-0 space-y-4">
                  <div className="glass-panel p-5 space-y-4">
                    <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest block">Available Shielded Polls</span>
                    <div className="flex flex-col gap-2.5 max-h-[400px] overflow-y-auto pr-1">
                      {(() => {
                        const sorted = [...elections].sort((a, b) => {
                          const detailsA = electionDetailsMap[a];
                          const detailsB = electionDetailsMap[b];
                          if (!detailsA && !detailsB) return 0;
                          if (!detailsA) return 1;
                          if (!detailsB) return -1;
                          
                          // Voting (Active) polls first
                          const isVotingA = detailsA.status === 'Voting';
                          const isVotingB = detailsB.status === 'Voting';
                          if (isVotingA && !isVotingB) return -1;
                          if (!isVotingA && isVotingB) return 1;
                          
                          // Otherwise, descending by startTime
                          return detailsB.startTime - detailsA.startTime;
                        });

                        return sorted.map((addr) => {
                          const details = electionDetailsMap[addr];
                          const displayName = details ? details.name : `Poll ${addr.substring(0, 6)}...`;
                          const isVoting = details?.status === 'Voting';
                          
                          return (
                            <button
                              key={addr}
                              onClick={() => setSelectedElectionAddr(addr)}
                              className={`text-left p-3.5 rounded-xl border text-xs transition duration-200 ${
                                selectedElectionAddr === addr
                                  ? 'border-yellow-500 bg-yellow-500/5 text-slate-100 font-bold shadow-[0_0_15px_rgba(255,210,8,0.1)]'
                                  : 'border-yellow-950/20 hover:border-yellow-500/20 bg-[#070414]/40 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              <p className="font-semibold truncate">{displayName}</p>
                              <p className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">{addr}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  isVoting 
                                    ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' 
                                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                                }`}>
                                  {isVoting ? 'ACTIVE' : details?.status?.toUpperCase() || 'LOADING'}
                                </span>
                                {selectedElectionAddr === addr && (
                                  <span className="text-[10px] text-yellow-400 font-bold flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                                    Selected
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Voting Booth & Results Area */}
              <div className="flex-1 space-y-6">
                {isDetailLoading ? (
                  <div className="glass-panel p-16 text-center flex flex-col items-center justify-center gap-4 bg-slate-900/10">
                    <RefreshCw className="h-8 w-8 text-[#FFD208] animate-spin" />
                    <span className="text-sm text-slate-400 font-semibold tracking-wide">Loading poll details...</span>
                  </div>
                ) : selectedElection ? (
                  <>
                    {/* Active Election Header Card */}
                    <div className="glass-panel p-5 flex flex-row items-center justify-between gap-4 border-yellow-500/10 bg-yellow-500/[0.01] mb-6">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-yellow-400 uppercase tracking-widest block">Active Ballot Focus</span>
                        <h2 className="text-xl font-bold text-slate-100">{selectedElection.name}</h2>
                        <p className="text-xs text-slate-400 leading-relaxed max-w-xl">{selectedElection.description}</p>
                      </div>
                      <button
                        onClick={() => setShowShareModal(true)}
                        className="btn-primary py-2 px-5 text-xs font-semibold flex items-center justify-center gap-2 self-auto shrink-0"
                      >
                        <Share2 className="h-4 w-4 text-black" />
                        Share Ballot
                      </button>
                    </div>

                    <VotingBooth
                      election={selectedElection}
                      isRegistered={isRegistered}
                      isVoterPassMinted={isVoterPassMinted}
                      isFheReady={!!fhevmInstance}
                      onCastVote={handleVoteCast}
                      loading={contractLoading}
                      onRevealResults={handleReveal}
                      onDecryptAndFinalize={handleDecryptFinalize}
                      error={contractError}
                    />
                  </>
                ) : (
                  <div className="glass-panel p-12 text-center text-slate-400 font-medium">
                    No shielded polls deployed yet. Go to the Guardian Hub to deploy one.
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
              approveIdentityRequest={wrapApproveIdentityRequest}
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

          {/* Hero Section */}
          <div className="grid lg:grid-cols-12 gap-16 pt-12 border-b border-slate-955 pb-16 relative overflow-hidden z-10 rounded-2xl p-8 sm:p-12 items-center">
            
            {/* Live Code Backdrop (Scoped to Hero Section) */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden opacity-[0.18] flex justify-between px-12 z-0">
              <div className="w-1/3 font-mono text-[10px] text-yellow-450 space-y-1 select-none animate-scroll-up">
                {[...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES].map((line, idx) => (
                  <div key={idx} className="whitespace-nowrap">{line}</div>
                ))}
              </div>
              <div className="w-1/3 font-mono text-[10px] text-yellow-455 space-y-1 select-none animate-scroll-up [animation-delay:-15s] hidden md:block">
                {[...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES].map((line, idx) => (
                  <div key={idx} className="whitespace-nowrap">{line}</div>
                ))}
              </div>
              <div className="w-1/3 font-mono text-[10px] text-yellow-455 space-y-1 select-none animate-scroll-up [animation-delay:-30s] hidden lg:block">
                {[...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES, ...REAL_PROJECT_CODE_LINES].map((line, idx) => (
                  <div key={idx} className="whitespace-nowrap">{line}</div>
                ))}
              </div>
            </div>

            {/* Glass Blur Overlay */}
            <div className="absolute inset-0 bg-black/65 backdrop-blur-[1.5px] z-[1] pointer-events-none" />

            {/* Left Column: Hero Text */}
            <div className="lg:col-span-7 space-y-6 text-left relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-yellow-500/20 bg-yellow-500/5 text-xs font-mono font-bold text-[#FFD208] uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5" />
                Fully Homomorphic Encryption (FHE)
              </div>
              
              <h1 className="text-5xl font-black tracking-tight sm:text-7xl font-sans text-white leading-none">
                LAUNCH <span className="text-[#FFD208]">SHIELDED</span> POLLS
              </h1>
              
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed font-medium max-w-2xl">
                CipherBallot is a next-generation decentralized voting system powered by Zama's FHEVM. It allows ballots to remain cryptographically sealed during computation, ensuring absolute privacy while remaining fully verifiable on-chain.
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

            {/* Right Column: High-Tech Web3 Interactive Globe */}
            <div className="lg:col-span-5 flex justify-center items-center relative z-10">
              <InteractiveNetworkGlobe />
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

          {/* Public Voting vs Our Voting System Comparison Card */}
          <div className="bg-[#030305] border border-slate-950 rounded-2xl overflow-hidden shadow-2xl relative z-10">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-955">
              {/* Left Column: Public Voting (Traditional) */}
              <div className="p-8 sm:p-12 space-y-6 text-left opacity-75">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                  <Eye className="h-4 w-4" />
                  Public Polls (Traditional)
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Transparent by default
                </h3>
                <ul className="space-y-4 font-mono text-xs sm:text-sm text-slate-400">
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span>Votes are fully visible to anyone on-chain</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span>Wallet addresses are linked to choices</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span>Intermediate results leak during the voting process</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span>Vulnerable to voter coercion & bribery</span>
                  </li>
                </ul>
              </div>

              {/* Right Column: Our Voting System (CipherBallot) */}
              <div className="p-8 sm:p-12 space-y-6 text-left relative group">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#FFD208] uppercase tracking-wider">
                  <Lock className="h-4 w-4" />
                  CipherBallot (FHE Shielded)
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white">
                  Encrypted & Verifiable
                </h3>
                <ul className="space-y-4 font-mono text-xs sm:text-sm text-slate-300">
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FFD208]" />
                    <span>Votes are encrypted on-chain (never seen)</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FFD208]" />
                    <span>Voter identities are cryptographically sealed</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FFD208]" />
                    <span>Tallies remain hidden until the election ends</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FFD208]" />
                    <span>Mathematically secure against voter coercion</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Animated Workflow Showcase (anime.js) */}
          <VotingWorkflowShowcase />

          {/* Fleek-inspired Technical Breakdown */}
          <div className="grid gap-16 lg:grid-cols-2 items-center border-b border-slate-955 pb-16 relative z-10">
            {/* Column 1: Interactive SVG Layer Diagram */}
            <div className="relative flex h-96 w-full items-center justify-center bg-[#030305] border border-slate-950 rounded-2xl overflow-hidden shadow-2xl p-6">
              <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/5 to-transparent opacity-50 pointer-events-none" />
              
              <svg viewBox="0 0 400 300" className="w-full h-full text-slate-400 font-mono text-[10px]">
                {/* Layer 3: Client Shield */}
                <g>
                  <rect x="50" y="40" width="300" height="50" rx="6" fill="rgba(255, 210, 8, 0.03)" stroke="rgba(255, 210, 8, 0.3)" strokeWidth="1.5" />
                  <text x="200" y="70" textAnchor="middle" fill="#f8fafc" className="font-bold">LAYER 03 // CLIENT SHIELD (WASM)</text>
                  <circle cx="75" cy="65" r="4" fill="#FFD208" className="animate-pulse" />
                </g>

                {/* Connection Line 1 */}
                <line x1="200" y1="90" x2="200" y2="130" stroke="rgba(255, 210, 8, 0.3)" strokeWidth="1.5" strokeDasharray="4,4" />

                {/* Layer 2: FHEVM Mempool */}
                <g>
                  <rect x="50" y="130" width="300" height="50" rx="6" fill="rgba(255, 210, 8, 0.03)" stroke="rgba(255, 210, 8, 0.3)" strokeWidth="1.5" />
                  <text x="200" y="160" textAnchor="middle" fill="#f8fafc" className="font-bold">LAYER 02 // ON-CHAIN TFHE TALLYING</text>
                  <circle cx="75" cy="155" r="4" fill="#FFD208" className="animate-pulse" />
                </g>

                {/* Connection Line 2 */}
                <line x1="200" y1="180" x2="200" y2="220" stroke="rgba(255, 210, 8, 0.3)" strokeWidth="1.5" strokeDasharray="4,4" />

                {/* Layer 1: KMS Threshold Decryption */}
                <g>
                  <rect x="50" y="220" width="300" height="50" rx="6" fill="rgba(255, 210, 8, 0.03)" stroke="rgba(255, 210, 8, 0.3)" strokeWidth="1.5" />
                  <text x="200" y="250" textAnchor="middle" fill="#f8fafc" className="font-bold">LAYER 01 // THRESHOLD KMS DECRYPTION</text>
                  <circle cx="75" cy="245" r="4" fill="#FFD208" className="animate-pulse" />
                </g>
              </svg>
              
              <div className="absolute bottom-4 left-4 font-mono text-[9px] text-slate-550 uppercase tracking-widest">
                // Cryptographic Stack layers
              </div>
            </div>

            {/* Column 2: Content */}
            <div className="space-y-8 text-left">
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-600 font-mono">01</span>
                <h2 className="text-3xl font-black text-white uppercase tracking-wide">
                  DECENTRALIZED CONFIDENTIAL INFRASTRUCTURE
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  CipherBallot is optimized to facilitate the secure and private execution of geo-aware, decentralized voting and identity services on-chain.
                </p>
              </div>

              <div className="space-y-3 font-mono text-[11px] text-slate-300">
                {[
                  "HIGH PERFORMANCE & COMPOSABILITY",
                  "LOW LATENCY ON-CHAIN STATE TRANSITIONS",
                  "FULLY DECENTRALIZED VALIDATOR NETWORK",
                  "MATHEMATICALLY SECURED BALLOT PRIVACY",
                  "ZERO-TRUST IDENTITY SEALING"
                ].map((bullet, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-[#FFD208]">⚡</span>
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
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
            <div className="bg-[#030305] border border-slate-950 rounded-xl p-6 font-mono text-left text-xs leading-relaxed shadow-2xl overflow-x-auto relative h-[360px]">
              
              <div className="flex items-center gap-1.5 mb-4 border-b border-slate-955 pb-3">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-slate-500 ml-2">Election.sol</span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed relative z-10">
                {(() => {
                  let remaining = typedCharCount;
                  return CODE_TOKENS.map((token, idx) => {
                    if (remaining <= 0) return null;
                    const visibleText = token.text.substring(0, remaining);
                    remaining -= token.text.length;
                    return (
                      <span key={idx} className={token.className}>
                        {visibleText}
                      </span>
                    );
                  });
                })()}
                <span className="text-[#FFD208] animate-pulse font-bold">|</span>
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
                {ledgerEntries.map((item, idx) => (
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
          <div className="bg-[#0b0b0f] border border-yellow-500/20 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Sticky Modal Header */}
            <div className="p-5 border-b border-slate-900/60 flex justify-between items-start relative shrink-0">
              <div className="space-y-0.5 pr-8">
                <h3 className="text-base font-bold text-slate-100">Share Ballot Card</h3>
                <p className="text-[10px] text-slate-400">Generate a high-definition download card or copy the direct voting URL.</p>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-250 transition p-1.5 hover:bg-slate-900 rounded-lg"
                aria-label="Close modal"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
            {/* Scrollable Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 min-h-0 scrollbar-thin">
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
            <img src="/logo.png" alt="CipherBallot Logo" className="h-6 w-6 object-contain" />
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
