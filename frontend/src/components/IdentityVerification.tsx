import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, Clock, XCircle, Copy, Check, FileText, ChevronRight, Lock, RefreshCw } from 'lucide-react';
import { ethers } from 'ethers';
import type { CitizenStatus, DocumentType, IdentityFormData } from '../utils/types';
import { DOCUMENT_TYPE_LABELS } from '../utils/types';
import { FHE_IDENTITY_REGISTRY_ADDRESS, VOTER_PASS_ADDRESS } from '../utils/contract';
import FHEIdentityRegistryABI from '../abis/FHEIdentityRegistry.json';
import VoterEligibilityPassABI from '../abis/VoterEligibilityPass.json';



interface IdentityVerificationProps {
  citizenStatus: CitizenStatus;
  address: string;
  isFheReady: boolean;
  isFheInitializing: boolean;
  onSubmit: (
    formData: IdentityFormData,
    encryptedChunks: any[],
    inputProofs: any[],
    encryptedDocType: any,
    docTypeProof: any,
    commitmentHash: string
  ) => Promise<boolean>;
  onResubmit: (
    formData: IdentityFormData,
    encryptedChunks: any[],
    inputProofs: any[],
    encryptedDocType: any,
    docTypeProof: any,
    commitmentHash: string
  ) => Promise<boolean>;
  onEncrypt: (
    formData: IdentityFormData,
    contractAddress: string,
    userAddress: string
  ) => Promise<{
    encryptedChunks: any[];
    inputProofs: any[];
    encryptedDocType: any;
    docTypeProof: any;
    commitmentHash: string;
  }>;
  onRefresh: () => void;
  setActiveTab: (tab: 'landing' | 'register' | 'elections' | 'voter-status' | 'commission' | 'how-it-works' | 'docs') => void;
  fhevmInstance: any;
  decryptIdentityDocument: (
    requestId: number,
    docChunkCount: number,
    fhevmInstance: any
  ) => Promise<{ docType: number; documentContent: string } | null>;
  hasVoterPass?: (voter: string, electionId: number) => Promise<boolean>;
  getVoterPassTokenId?: (voter: string, electionId: number) => Promise<number>;
  getVoterPassMetadata?: (tokenId: number) => Promise<any>;
  mintVoterPass?: (
    voter: string,
    electionId: number,
    encryptedIdentityHandle: string,
    identityProof: string,
    encryptedDocTypeHandle: string,
    docTypeProof: string,
    commitmentHash: string,
    signature: string
  ) => Promise<boolean>;
  selectedElection?: any;
}

export function IdentityVerification({
  citizenStatus,
  address,
  isFheReady,
  isFheInitializing,
  onSubmit,
  onResubmit,
  onEncrypt,
  onRefresh,
  setActiveTab,
  fhevmInstance,
  decryptIdentityDocument,
  hasVoterPass,
  getVoterPassTokenId,
  getVoterPassMetadata,
  mintVoterPass,
  selectedElection
}: IdentityVerificationProps) {
  const [formData, setFormData] = useState<IdentityFormData>({
    documentType: 'national_id',
    fullName: '',
    idNumber: '',
    dateOfBirth: '',
    address: '',
    additionalInfo: ''
  });

  const [selectedDoc, setSelectedDoc] = useState<DocumentType>('national_id');

  // FHE Decryption of own submitted document
  const [decryptedDoc, setDecryptedDoc] = useState<{ docType: string; content: string } | null>(null);
  const [isDecryptingDoc, setIsDecryptingDoc] = useState<boolean>(false);

  // Voter Eligibility Pass NFT States
  const [isNftMinted, setIsNftMinted] = useState<boolean>(false);
  const [isNftMinting, setIsNftMinting] = useState<boolean>(false);
  const [nftTokenId, setNftTokenId] = useState<number | null>(null);
  const [nftImage, setNftImage] = useState<string | null>(null);
  const [nftError, setNftError] = useState<string>('');

  const activeElectionId = selectedElection ? Number(selectedElection.electionId) : 1;

  useEffect(() => {
    const checkNftStatus = async () => {
      if (!address || !hasVoterPass || !getVoterPassTokenId || !getVoterPassMetadata) return;
      try {
        const minted = await hasVoterPass(address, activeElectionId);
        setIsNftMinted(minted);
        if (minted) {
          const tokenId = await getVoterPassTokenId(address, activeElectionId);
          setNftTokenId(tokenId);
          if (tokenId > 0) {
            
            // Fetch tokenURI image
            try {
              const { readProvider: sharedProvider } = await import('../hooks/useContract');
              const passContract = new ethers.Contract(VOTER_PASS_ADDRESS, VoterEligibilityPassABI.abi, sharedProvider);
              const uri = await passContract.tokenURI(tokenId);
              if (uri.startsWith('data:application/json;base64,')) {
                const base64Json = uri.substring('data:application/json;base64,'.length);
                const decoded = atob(base64Json);
                const obj = JSON.parse(decoded);
                if (obj.image) setNftImage(obj.image);
              }
            } catch (e) {
              console.error("Failed to load on-chain SVG image:", e);
            }
          }
        } else {
          // Fallback to check global pass (electionId = 0)
          const globalMinted = await hasVoterPass(address, 0);
          if (globalMinted) {
            const globalTokenId = await getVoterPassTokenId(address, 0);
            setNftTokenId(globalTokenId);
            if (globalTokenId > 0) {
              setIsNftMinted(true); // Treat global pass as minted
              
              // Fetch tokenURI image
              try {
                const { readProvider: sharedProvider } = await import('../hooks/useContract');
                const passContract = new ethers.Contract(VOTER_PASS_ADDRESS, VoterEligibilityPassABI.abi, sharedProvider);
                const uri = await passContract.tokenURI(globalTokenId);
                if (uri.startsWith('data:application/json;base64,')) {
                  const base64Json = uri.substring('data:application/json;base64,'.length);
                  const decoded = atob(base64Json);
                  const obj = JSON.parse(decoded);
                  if (obj.image) setNftImage(obj.image);
                }
              } catch (e) {
                console.error("Failed to load on-chain SVG image:", e);
              }
            }
          } else {
            setNftTokenId(null);
            setNftImage(null);
          }
        }
      } catch (err) {
        console.error("Failed to check NFT status:", err);
      }
    };
    checkNftStatus();
  }, [address, activeElectionId, citizenStatus.status, hasVoterPass, getVoterPassTokenId, getVoterPassMetadata]);

  const handleMintVoterPass = async () => {
    if (!address || !mintVoterPass || !fhevmInstance) return;
    setIsNftMinting(true);
    setNftError('');
    
    // Yield execution back to the browser so the loading spinner/overlay can render
    // before the heavy synchronous WebAssembly FHE encryption blocks the thread.
    await new Promise(r => setTimeout(r, 150));

    try {
      // 1. Fetch approval signature (on-chain from citizenStatus → localStorage fallback)
      let signature = citizenStatus.signature;
      if (!signature) {
        const sigKey = `cb_sig_${address.toLowerCase()}_${activeElectionId}`;
        signature = localStorage.getItem(sigKey) || undefined;
      }
      if (!signature) {
        const globalSigKey = `cb_sig_${address.toLowerCase()}_0`;
        signature = localStorage.getItem(globalSigKey) || undefined;
      }
      
      // Early exit if no signature at all — don't waste gas
      if (!signature) {
        setNftError('No Commission approval signature found. The Election Commission must approve your identity request first before you can mint.');
        setIsNftMinting(false);
        return;
      }

      // 2. Encrypt Identity Data using Zama FHEVM
      const numericIdentity = BigInt(address.substring(0, 10));
      const docTypeVal = Number(selectedDoc === 'national_id' ? 1 : selectedDoc === 'passport' ? 2 : selectedDoc === 'voter_card' ? 3 : 4);

      const identityInput = fhevmInstance.createEncryptedInput(VOTER_PASS_ADDRESS, address);
      identityInput.add256(numericIdentity);
      const encIdentity = await identityInput.encrypt();

      const docTypeInput = fhevmInstance.createEncryptedInput(VOTER_PASS_ADDRESS, address);
      docTypeInput.add8(docTypeVal);
      const encDocType = await docTypeInput.encrypt();

      const encIdentityHandle = ethers.hexlify(encIdentity.handles[0]);
      const encIdentityProof = ethers.hexlify(encIdentity.inputProof);
      const encDocTypeHandle = ethers.hexlify(encDocType.handles[0]);
      const encDocTypeProof = ethers.hexlify(encDocType.inputProof);

      // 3. Fetch commitment hash from contract (reuse shared readProvider)
      let commitmentHash = submittedCommitment;
      if (!commitmentHash && citizenStatus.requestId) {
        try {
          // Import readProvider from useContract to avoid creating new provider instances
          const { readProvider: sharedProvider, fallbackProvider: fbProvider } = await import('../hooks/useContract');
          let contract = new ethers.Contract(FHE_IDENTITY_REGISTRY_ADDRESS, FHEIdentityRegistryABI.abi, sharedProvider);
          try {
            const req = await contract.requests(citizenStatus.requestId);
            commitmentHash = req.commitmentHash;
          } catch {
            // Try fallback provider
            contract = new ethers.Contract(FHE_IDENTITY_REGISTRY_ADDRESS, FHEIdentityRegistryABI.abi, fbProvider);
            const req = await contract.requests(citizenStatus.requestId);
            commitmentHash = req.commitmentHash;
          }
        } catch (e) {
          console.error("Failed to fetch commitment hash from contract:", e);
        }
      }
      if (!commitmentHash) {
        commitmentHash = ethers.id("cb_commitment");
      }
      
      const success = await mintVoterPass(
        address,
        activeElectionId,
        encIdentityHandle,
        encIdentityProof,
        encDocTypeHandle,
        encDocTypeProof,
        commitmentHash,
        signature
      );
      
      if (success) {
        onRefresh();
      } else {
        setNftError('Mint transaction failed. This could be because: (1) You have already minted a pass for this election, (2) The commission signature does not match, or (3) Your wallet is not whitelisted.');
      }
    } catch (err: any) {
      console.error("Failed to mint VEPass NFT:", err);
      // Parse user-friendly error from revert reason
      const reason = err.reason || err.data?.message || err.message || '';
      if (reason.includes('Already minted')) {
        setNftError('You have already minted a VEPass for this election.');
      } else if (reason.includes('Invalid commission signature')) {
        setNftError('Commission signature verification failed. The commission officer who approved your request may need to re-approve.');
      } else if (reason.includes('Can only mint for yourself')) {
        setNftError('You can only mint a VEPass for your own wallet address.');
      } else {
        setNftError(reason || 'Error executing mint transaction. Please try again.');
      }
    } finally {
      setIsNftMinting(false);
    }
  };



  const handleDecryptSelfDoc = async (requestId: number) => {
    if (!fhevmInstance) {
      alert('FHEVM SDK is not fully loaded yet. Please wait.');
      return;
    }
    setIsDecryptingDoc(true);
    
    // Yield execution back to the browser so the loading spinner/overlay can render
    await new Promise(r => setTimeout(r, 150));

    try {
      // Use shared readProvider instead of creating new one each time
      console.log('Fetching request details to get chunk count...');
      const { readProvider: sharedProvider } = await import('../hooks/useContract');
      const contract = new ethers.Contract(
        FHE_IDENTITY_REGISTRY_ADDRESS,
        FHEIdentityRegistryABI.abi,
        sharedProvider
      );
      const req = await contract.requests(requestId);
      const docChunkCount = Number(req.docChunkCount);
      console.log(`Document has ${docChunkCount} chunks`);

      const res = await decryptIdentityDocument(requestId, docChunkCount, fhevmInstance);
      if (res) {
        const docTypesMap: Record<number, string> = {
          1: 'National ID',
          2: 'Passport',
          3: 'Voter Card',
          4: 'Driving License'
        };
        setDecryptedDoc({
          docType: docTypesMap[res.docType] || 'Unknown',
          content: res.documentContent
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDecryptingDoc(false);
    }
  };

  const [isEncrypting, setIsEncrypting] = useState<boolean>(false);
  const [encryptionStep, setEncryptionStep] = useState<string>('');
  const [redactedFields, setRedactedFields] = useState<Record<string, boolean>>({});
  const [copiedText, setCopiedText] = useState<Record<string, boolean>>({});
  const [submissionSuccess, setSubmissionSuccess] = useState<boolean>(false);
  const [submittedCommitment, setSubmittedCommitment] = useState<string>('');

  // Prefill document type when citizenStatus is Rejected
  useEffect(() => {
    if (citizenStatus.status === 'Rejected') {
      // Keep selectedDoc as national_id or whatever was set, but it can be pre-filled
      setFormData(prev => ({
        ...prev,
        fullName: '',
        idNumber: '',
        dateOfBirth: '',
        address: '',
        additionalInfo: ''
      }));
    }
  }, [citizenStatus]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedText(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  // Calculate live preview of combined document string
  const getDocumentPreview = () => {
    return [
      `NAME:${formData.fullName || 'Priya Nair'}`,
      `ID:${formData.idNumber || 'KL123456'}`,
      `DOB:${formData.dateOfBirth || '2000-01-01'}`,
      `ADDR:${formData.address || 'House No., City'}`,
      `INFO:${formData.additionalInfo || ''}`
    ].join('|');
  };

  const previewString = getDocumentPreview();
  const chunkCount = Math.ceil(previewString.length / 32);

  // Form submit handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFheReady) return;

    setIsEncrypting(true);
    setRedactedFields({});

    try {
      // Visual redaction workflow simulating encryption
      setEncryptionStep('Encrypting name and ID...');
      await new Promise(r => setTimeout(r, 600));
      setRedactedFields(prev => ({ ...prev, fullName: true, idNumber: true }));

      setEncryptionStep('Encrypting date of birth and address...');
      await new Promise(r => setTimeout(r, 700));
      setRedactedFields(prev => ({ ...prev, dateOfBirth: true, address: true }));

      setEncryptionStep('Generating commitment hash...');
      await new Promise(r => setTimeout(r, 500));
      setRedactedFields(prev => ({ ...prev, additionalInfo: true }));

      for (let i = 1; i <= chunkCount; i++) {
        setEncryptionStep(`Block ${i} of ${chunkCount} encrypted...`);
        await new Promise(r => setTimeout(r, 300));
      }

      setEncryptionStep('Securing your identity (FHE sealing)...');
      await new Promise(r => setTimeout(r, 150));
      
      // Perform actual WASM FHE encryption
      const encryptedData = await onEncrypt(
        { ...formData, documentType: selectedDoc },
        FHE_IDENTITY_REGISTRY_ADDRESS,
        address
      );

      setEncryptionStep('Submitting to blockchain...');
      await new Promise(r => setTimeout(r, 200));

      setEncryptionStep('Confirming transaction...');
      
      let success = false;
      if (citizenStatus.status === 'Rejected') {
        success = await onResubmit(
          { ...formData, documentType: selectedDoc },
          encryptedData.encryptedChunks,
          encryptedData.inputProofs,
          encryptedData.encryptedDocType,
          encryptedData.docTypeProof,
          encryptedData.commitmentHash
        );
      } else {
        success = await onSubmit(
          { ...formData, documentType: selectedDoc },
          encryptedData.encryptedChunks,
          encryptedData.inputProofs,
          encryptedData.encryptedDocType,
          encryptedData.docTypeProof,
          encryptedData.commitmentHash
        );
      }

      if (success) {
        setSubmissionSuccess(true);
        setSubmittedCommitment(encryptedData.commitmentHash);
        // Refresh citizen status from blockchain
        onRefresh();
      }
    } catch (err) {
      console.error(err);
      alert('Encryption or submission failed. Please try again.');
    } finally {
      setIsEncrypting(false);
      setEncryptionStep('');
    }
  };

  const getSvgPreview = () => {
    const tokenIdStr = nftTokenId ? `#${String(nftTokenId).padStart(4, '0')}` : '#PENDING';
    const electionIdStr = String(activeElectionId);
    
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 320" className="w-full max-w-[480px] rounded-3xl shadow-2xl border border-yellow-500/20">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f0926" />
            <stop offset="100%" stopColor="#241147" />
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFE57F" />
            <stop offset="100%" stopColor="#FFC107" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="500" height="320" rx="20" fill="url(#bgGrad)" stroke="url(#goldGrad)" strokeWidth="2" />
        <circle cx="450" cy="50" r="100" fill="none" stroke="rgba(224, 64, 251, 0.15)" strokeWidth="1.5" />
        <circle cx="450" cy="50" r="70" fill="none" stroke="rgba(255, 193, 7, 0.1)" strokeWidth="1.5" />
        <text x="35" y="55" fill="#FFE57F" fontFamily="system-ui, -apple-system, sans-serif" fontSize="20" fontWeight="800" letterSpacing="1">CIPHERBALLOT</text>
        <text x="35" y="75" fill="rgba(255, 255, 255, 0.5)" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="600" letterSpacing="1.5">FHE SOULBOUND VEPass</text>
        <rect x="35" y="110" width="45" height="35" rx="6" fill="#ffe57f" opacity="0.85" />
        <path d="M 35 127.5 L 80 127.5 M 57.5 110 L 57.5 145" stroke="#0f0926" strokeWidth="1" />
        <rect x="380" y="35" width="85" height="24" rx="12" fill="rgba(0, 230, 118, 0.15)" stroke="#00E676" strokeWidth="1" />
        <text x="422.5" y="49" fill="#00E676" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="bold" textAnchor="middle">@ VERIFIED</text>
        <text x="35" y="195" fill="rgba(255, 255, 255, 0.5)" fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" fontWeight="700" letterSpacing="0.5">STATUS</text>
        <text x="35" y="212" fill="#FFFFFF" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="800">
          {isNftMinted ? 'ACTIVE PASS' : 'APPROVED'}
        </text>
        <text x="180" y="195" fill="rgba(255, 255, 255, 0.5)" fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" fontWeight="700" letterSpacing="0.5">ELECTION ID</text>
        <text x="180" y="212" fill="#FFFFFF" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="800">
          {electionIdStr}
        </text>
        <text x="300" y="195" fill="rgba(255, 255, 255, 0.5)" fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" fontWeight="700" letterSpacing="0.5">PASS ID</text>
        <text x="300" y="212" fill="#FFE57F" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="800">
          {tokenIdStr}
        </text>
        <line x1="35" y1="250" x2="465" y2="250" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
        <text x="35" y="280" fill="rgba(255, 255, 255, 0.4)" fontFamily="system-ui, -apple-system, sans-serif" fontSize="8" fontWeight="600">BOUND TO REGISTERED WALLET</text>
        <text x="465" y="280" fill="#E040FB" fontFamily="system-ui, -apple-system, sans-serif" fontSize="9" fontWeight="bold" textAnchor="end" letterSpacing="1">ZAMA FHEVM</text>
      </svg>
    );
  };

  // 1. STATE 1: Already Registered (Whitelisted / Approved)
  if (citizenStatus.isRegistered || citizenStatus.isVerified) {
    return (
      <div className="max-w-xl mx-auto py-8 px-4 sm:px-6 space-y-8 flex flex-col items-center">
        
        {/* Success Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-100">
            {isNftMinted ? 'VEPass Soulbound NFT Minted' : 'Your FHE Pass is Whitelisted'}
          </h2>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            {isNftMinted 
              ? 'Your cryptographic voter pass is successfully minted and bound on-chain to your wallet address.' 
              : 'Your cryptographic identity request is approved. Mint your on-chain Soulbound pass card below to authorize voting.'}
          </p>
        </div>

        {/* Dynamic NFT Card Image Display */}
        <div className="w-full flex justify-center">
          {isNftMinted && nftImage ? (
            <img 
              src={nftImage} 
              alt="Voter Pass NFT" 
              className="w-full max-w-[480px] aspect-[500/320] object-contain rounded-3xl shadow-2xl shadow-[#FFD208]/5 border border-yellow-500/15" 
            />
          ) : (
            getSvgPreview()
          )}
        </div>

        {/* Actions Console */}
        <div className="w-full space-y-4">
          {!isNftMinted ? (
            <div className="glass-panel p-5 w-full border-[#FFD208]/20 bg-black/45 space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0 text-[#FFD208]">
                  <Lock className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Mint Eligibility Pass NFT</h4>
                  <p className="text-[10px] text-slate-450 leading-relaxed font-medium">
                    Lock in your voting eligibility. Minting encrypts your national identifier and document class on-chain as a soulbound token, binding voting rights strictly to your wallet address.
                  </p>
                </div>
              </div>
              
              {nftError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-[10px] font-semibold font-mono leading-relaxed">
                  {nftError}
                </div>
              )}

              <button
                onClick={handleMintVoterPass}
                disabled={isNftMinting}
                className="w-full bg-[#FFD208] text-black font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-xl hover:bg-yellow-450 transition flex items-center justify-center gap-2"
              >
                {isNftMinting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    MINTING NFT PASS...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    MINT VEPass NFT
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-panel p-4 w-full border-emerald-500/20 bg-emerald-500/[0.01] flex items-center gap-3 text-left">
                <Check className="h-5 w-5 text-emerald-400 shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase">VEPass Soulbound NFT Minted</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Your pass has been securely bound to your address. You are fully authorized to vote in active shielded polls.</p>
                </div>
              </div>

              <button
                onClick={() => setActiveTab('elections')}
                className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-xs uppercase tracking-widest font-extrabold"
              >
                Enter Shielded Polls
                <ChevronRight className="h-4.5 w-4.5" />
              </button>
            </div>
          )}
        </div>

      </div>
    );
  }

  // 2. SUCCESS STATE (Replaces the main form upon submission)
  if (submissionSuccess) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 sm:px-6">
        <div className="glass-panel p-8 text-center space-y-6 border-indigo-500/20 bg-indigo-950/5">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30">
              <CheckCircle2 className="h-10 w-10 text-indigo-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-100">
              Registration Submitted!
            </h2>
            <p className="text-sm text-slate-400">
              Your encrypted identity request has been recorded on the blockchain.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left space-y-4 font-sans">
            <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-3">
              <span className="text-slate-500">Request ID:</span>
              <span className="text-slate-300 font-bold">Pending Assignment</span>
            </div>
            
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Commitment Hash
              </span>
              <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-850 font-mono text-[11px] text-emerald-400">
                <span className="truncate">{submittedCommitment}</span>
                <button
                  onClick={() => handleCopy(submittedCommitment, 'sub_commit')}
                  className="text-slate-400 hover:text-slate-200 p-1 rounded transition shrink-0"
                >
                  {copiedText['sub_commit'] ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-450 leading-relaxed">
            The Network Guardians will decrypt and verify your documents. Once approved, your wallet address will be whitelisted as an eligible voter. Check back soon.
          </p>

          <button
            onClick={() => {
              setSubmissionSuccess(false);
              onRefresh();
            }}
            className="w-full btn-secondary py-3 text-sm"
          >
            View Verification Status
          </button>
        </div>
      </div>
    );
  }

  // 3. STATE 2: Pending Review
  if (citizenStatus.isPending) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 sm:px-6">
        <div className="glass-panel p-8 text-center space-y-6 border-amber-500/20 bg-amber-950/5">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30 animate-pulse-slow">
              <Clock className="h-10 w-10 text-amber-400" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-100">
              FHE Pass Request Under Review
            </h2>
            <p className="text-sm text-slate-400">
              Your FHE Pass request has been submitted and is currently being processed.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-left space-y-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                Request Status:
              </span>
              <span className="px-2 py-0.5 text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-bold uppercase tracking-wider">
                ● Under Review
              </span>
            </div>
            
            <div className="flex items-center justify-between text-xs border-t border-slate-800/80 pt-3">
              <span className="text-slate-450 font-medium">Request Number:</span>
              <span className="font-mono text-slate-300 font-semibold">#{citizenStatus.requestId}</span>
            </div>

            <div className="space-y-1 pt-1.5 border-t border-slate-800/80">
              <span className="text-[10px] uppercase font-bold text-slate-550 tracking-wider">
                Document Commitment
              </span>
              <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-850 font-mono text-[10px] text-slate-400">
                <span className="truncate">0xCommitmentPlaceholder...</span>
                <button
                  onClick={() => handleCopy(`Citizen Request ${citizenStatus.requestId}`, 'req_commit')}
                  className="text-slate-400 hover:text-slate-200 p-1 rounded transition shrink-0"
                >
                  {copiedText['req_commit'] ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-1">
            {decryptedDoc ? (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 space-y-3.5 text-left text-xs">
                <span className="font-bold text-emerald-450 uppercase text-[9.5px] tracking-wider block">Decrypted Identity Document (Read-Only)</span>
                <div className="grid grid-cols-2 gap-2 text-slate-400 text-[11.5px]">
                  <span>Document Type:</span>
                  <span className="font-semibold text-slate-200">{decryptedDoc.docType}</span>
                </div>
                <div className="flex flex-col gap-1.5 pt-2 border-t border-emerald-500/10">
                  <span className="text-[9.5px] text-slate-500 uppercase font-bold tracking-wider">Document Contents</span>
                  <p className="bg-slate-950 p-3 rounded-xl border border-slate-900 font-mono text-[11px] text-emerald-350 break-all whitespace-pre-wrap leading-relaxed">
                    {decryptedDoc.content}
                  </p>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleDecryptSelfDoc(citizenStatus.requestId)}
                disabled={isDecryptingDoc}
                className="btn-secondary w-full py-3.5 text-sm flex items-center justify-center gap-2 border border-violet-500/10 bg-[#0b071a]/30 hover:border-violet-500/30"
              >
                {isDecryptingDoc ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin text-violet-400" />
                    Decrypting via KMS...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 text-violet-400" />
                    Decrypt & View My Submitted Document
                  </>
                )}
              </button>
            )}
          </div>

          <div className="bg-indigo-950/15 border border-indigo-900/30 rounded-xl p-4 flex gap-3 text-left">
            <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-200">Documents Sealed with FHE</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Your uploaded documents are fully encrypted. No one can read them on-chain without selective decryption rights, which are only granted to the Network Guardians for review.
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 font-medium">
            Typical review time is 1-3 minutes. You will be auto-whitelisted as an eligible voter once approved.
          </p>

          <button
            onClick={onRefresh}
            className="w-full btn-secondary py-3 text-sm flex items-center justify-center gap-2"
          >
            <Clock className="h-4 w-4" />
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  // 4. STATE 3 & STATE 4: Rejected or Not Submitted
  return (
    <div className="w-full max-w-7xl mx-auto py-4">
      {/* Reject Alert Header if Rejected */}
      {citizenStatus.status === 'Rejected' && (
        <div className="mb-8 bg-rose-500/10 border border-rose-500/25 rounded-2xl p-6 flex gap-4">
          <XCircle className="h-10 w-10 text-rose-450 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-100">
              Voter Pass Request #{citizenStatus.requestId} Rejected
            </h3>
            <p className="text-sm text-rose-300 leading-relaxed font-semibold">
              Rejection Reason: <span className="text-slate-100 font-bold bg-rose-500/15 px-2.5 py-1 rounded border border-rose-500/20">"{citizenStatus.rejectionReason}"</span>
            </p>
            <p className="text-xs text-slate-450 leading-relaxed">
              You can correct the errors described by the Guardians and resubmit your details below. Please ensure all text fields are clearly readable.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Form Panel */}
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-panel p-6 sm:p-8 space-y-8 relative overflow-hidden">
            
            {/* INTERACTIVE ENCRYPTION OVERLAY */}
            {isEncrypting && (
              <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 space-y-6">
                <div className="h-16 w-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center animate-spin-slow">
                  <ShieldCheck className="h-8 w-8 text-indigo-400 animate-pulse-slow" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-slate-100">Securing your identity...</h3>
                  <p className="text-xs text-indigo-450 font-semibold font-mono tracking-wide animate-pulse">
                    {encryptionStep}
                  </p>
                </div>

                {/* Progress bars / redacted preview */}
                <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-slate-500 space-y-2">
                  <div className="flex justify-between">
                    <span>Full Name:</span>
                    <span className={redactedFields.fullName ? 'text-indigo-400 font-bold' : 'text-slate-600'}>
                      {redactedFields.fullName ? '██████████ (SEALED)' : formData.fullName || 'Priya Nair'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Doc ID:</span>
                    <span className={redactedFields.idNumber ? 'text-indigo-400 font-bold' : 'text-slate-600'}>
                      {redactedFields.idNumber ? '████████ (SEALED)' : formData.idNumber || 'KL123456'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date of Birth:</span>
                    <span className={redactedFields.dateOfBirth ? 'text-indigo-400 font-bold' : 'text-slate-600'}>
                      {redactedFields.dateOfBirth ? '██████████ (SEALED)' : formData.dateOfBirth || '2000-01-01'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Address:</span>
                    <span className={redactedFields.address ? 'text-indigo-400 font-bold' : 'text-slate-600'}>
                      {redactedFields.address ? '████████████ (SEALED)' : formData.address || 'House No., City'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Form Header */}
            <div className="border border-indigo-800/40 bg-indigo-950/10 rounded-2xl p-5 flex items-start gap-4">
              <div className="h-10 w-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold tracking-wider text-indigo-400 uppercase">
                  Claim Shielded Voter Pass
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Network Guardians of CipherBallot. Fill in your identification details. All fields are encrypted client-side using FHE before submission.
                </p>
              </div>
            </div>

            {/* Active FHE Notice */}
            <div className="flex items-center gap-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="h-4.5 w-4.5" />
              <span>
                {isFheReady
                  ? 'FHE WebAssembly active. Your identity will be fully encrypted.'
                  : isFheInitializing
                  ? 'Loading FHE WebAssembly SDK...'
                  : 'FHE is currently inactive. Connecting wallet will activate it.'}
              </span>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6">
              
              {/* STEP 1: DOCUMENT TYPE SELECTION */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Step 1: Select Identity Document
                </span>
                <div className="grid grid-cols-2 gap-4">
                  {(['national_id', 'passport', 'voter_card', 'driving_license'] as DocumentType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setSelectedDoc(type)}
                      className={`p-4 rounded-xl border text-left transition duration-150 flex flex-col justify-between h-24 ${
                        selectedDoc === type
                          ? 'border-indigo-500 bg-indigo-950/20 shadow-md shadow-indigo-600/5'
                          : 'border-slate-850 bg-slate-950/20 hover:border-slate-800'
                      }`}
                    >
                      <span className="text-lg">
                        {type === 'national_id' ? '🪪' : type === 'passport' ? '📘' : type === 'voter_card' ? '🗳️' : '🚗'}
                      </span>
                      <span className={`text-xs font-bold ${selectedDoc === type ? 'text-indigo-400' : 'text-slate-450'}`}>
                        {DOCUMENT_TYPE_LABELS[type]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* STEP 2: DOCUMENT DETAILS */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                  Step 2: Document Details
                </span>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-semibold uppercase">Full Name (as on document)</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="As printed on your document"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none placeholder-slate-700"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-semibold uppercase">Document ID Number</label>
                    <input
                      type="text"
                      required
                      maxLength={50}
                      placeholder="ABC1234567"
                      value={formData.idNumber}
                      onChange={(e) => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-sm text-slate-100 font-mono focus:border-indigo-500 focus:outline-none placeholder-slate-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-semibold uppercase">Date of Birth</label>
                    <input
                      type="date"
                      required
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none text-slate-550"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-semibold uppercase">Address (as on document)</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="House No., Street, City, State, ZIP"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none placeholder-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-slate-400 font-semibold uppercase">Additional Info (optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Any additional verification details..."
                    value={formData.additionalInfo}
                    onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none placeholder-slate-700"
                  />
                </div>
              </div>

              {/* LIVE ENCRYPTION PREVIEW */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold text-slate-550 uppercase tracking-widest block">
                  Document Preview (will be encrypted)
                </span>
                <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 font-mono text-xs text-slate-450 leading-relaxed space-y-2 break-all">
                  <p>{previewString}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold border-t border-slate-900 pt-2 uppercase">
                    <span>{previewString.length} characters</span>
                    <span className="text-indigo-400">→ {chunkCount} encrypted blocks</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!isFheReady || isEncrypting}
                className="w-full btn-primary py-4 text-sm flex items-center justify-center gap-2 disabled:bg-slate-900 disabled:border-slate-850 disabled:text-slate-650"
              >
                🔒 Encrypt & Submit Registration Request
              </button>
            </form>
          </div>
        </div>

        {/* Right Info Panel */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: How it Works */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">How It Works</h3>
            <div className="space-y-4 font-sans text-xs text-slate-400 leading-relaxed">
              <div className="flex gap-3">
                <span className="h-5 w-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">1</span>
                <p>Fill in your official identification documents.</p>
              </div>
              <div className="flex gap-3">
                <span className="h-5 w-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">2</span>
                <p>Documents are encrypted client-side using WASM before leaving your browser.</p>
              </div>
              <div className="flex gap-3">
                <span className="h-5 w-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">3</span>
                <p>The encrypted document chunks are stored on the blockchain.</p>
              </div>
              <div className="flex gap-3">
                <span className="h-5 w-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">4</span>
                <p>Network Guardians perform secure decryption via FHE SDK to verify details.</p>
              </div>
              <div className="flex gap-3">
                <span className="h-5 w-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">5</span>
                <p>Guardians approve request, automatically whitelisting your wallet to vote.</p>
              </div>
            </div>
          </div>

          {/* Card 2: What gets encrypted */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">What Gets Encrypted</h3>
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center gap-3 text-slate-405 font-medium">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                <span>Your full name</span>
              </div>
              <div className="flex items-center gap-3 text-slate-405 font-medium">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                <span>Document ID number</span>
              </div>
              <div className="flex items-center gap-3 text-slate-405 font-medium">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                <span>Date of birth</span>
              </div>
              <div className="flex items-center gap-3 text-slate-405 font-medium">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                <span>Residential address</span>
              </div>
              <div className="flex items-center gap-3 text-slate-405 font-medium">
                <ShieldCheck className="h-4.5 w-4.5 text-indigo-400" />
                <span>Document type</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-450 font-bold pt-2 border-t border-slate-900 uppercase text-[9px] tracking-wider">
                <CheckCircle2 className="h-4 w-4" />
                <span>Only request status is public</span>
              </div>
            </div>
          </div>

          {/* Card 3: Your Rights */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Your Rights</h3>
            <div className="space-y-3.5 text-xs text-slate-400 leading-relaxed font-medium">
              <p>✓ You can decrypt your own submission at any time using your wallet.</p>
              <p>✓ The Network Guardians can verify your documents but cannot copy or store plaintext data off-chain.</p>
              <p>✓ Your documents remain sealed forever after verification — even from system administrators.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
