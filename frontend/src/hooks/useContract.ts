import { useState, useCallback } from 'react';
import { Contract, BrowserProvider, JsonRpcSigner, JsonRpcProvider, ethers } from 'ethers';

// Import ABIs from the generated files
import VoterRegistryABI from '../abis/VoterRegistry.json';
import ElectionFactoryABI from '../abis/ElectionFactory.json';
import ElectionABI from '../abis/Election.json';
import FHEIdentityRegistryABI from '../abis/FHEIdentityRegistry.json';

// Import contract addresses
import {
  VOTER_REGISTRY_ADDRESS,
  ELECTION_FACTORY_ADDRESS,
  FHE_IDENTITY_REGISTRY_ADDRESS
} from '../utils/contract';

import type { CitizenStatus, IdentityFormData, IdentityRequest, RequestStatus } from '../utils/types';

export interface CandidateInfo {
  name: string;
  party: string;
  symbol: string;
}

export interface ElectionDetails {
  address: string;
  electionId: number;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  totalVotesCast: number;
  candidateCount: number;
  resultsRevealed: boolean;
  commissionAddress: string;
  candidates: CandidateInfo[];
  results: number[];
  isVoted: boolean;
  status: 'NotStarted' | 'Voting' | 'Closed' | 'Decrypted';
}

// Dedicated read-only provider using proxied Alchemy RPC
// (proxied through Vite dev server to comply with COEP headers required by FHE WASM)
const SEPOLIA_RPC_URL = typeof window !== 'undefined' ? window.location.origin + '/api/rpc' : 'http://localhost:5173/api/rpc';
const readProvider = new JsonRpcProvider(SEPOLIA_RPC_URL);

export function useContract(_provider: BrowserProvider | null, signer: JsonRpcSigner | null, userAddress: string) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Read-only contract instances (use Alchemy RPC for reliable reads)
  const getRegistryContractRead = useCallback(() => {
    return new Contract(VOTER_REGISTRY_ADDRESS, VoterRegistryABI.abi, readProvider);
  }, []);

  const getIdentityRegistryContractRead = useCallback(() => {
    return new Contract(FHE_IDENTITY_REGISTRY_ADDRESS, FHEIdentityRegistryABI.abi, readProvider);
  }, []);

  const getFactoryContractRead = useCallback(() => {
    return new Contract(ELECTION_FACTORY_ADDRESS, ElectionFactoryABI.abi, readProvider);
  }, []);

  const getElectionContractRead = useCallback((electionAddress: string) => {
    return new Contract(electionAddress, ElectionABI.abi, readProvider);
  }, []);

  // Write contract instances (use wallet signer for transactions)
  const getRegistryContract = useCallback(() => {
    if (!signer) throw new Error('Wallet signer not initialized');
    return new Contract(VOTER_REGISTRY_ADDRESS, VoterRegistryABI.abi, signer);
  }, [signer]);

  const getIdentityRegistryContract = useCallback(() => {
    if (!signer) throw new Error('Wallet signer not initialized');
    return new Contract(FHE_IDENTITY_REGISTRY_ADDRESS, FHEIdentityRegistryABI.abi, signer);
  }, [signer]);

  const getFactoryContract = useCallback(() => {
    if (!signer) throw new Error('Wallet signer not initialized');
    return new Contract(ELECTION_FACTORY_ADDRESS, ElectionFactoryABI.abi, signer);
  }, [signer]);

  const getElectionContract = useCallback((electionAddress: string) => {
    if (!signer) throw new Error('Wallet signer not initialized');
    return new Contract(electionAddress, ElectionABI.abi, signer);
  }, [signer]);

  // 2. Voter Registry Operations
  const isVoterRegistered = useCallback(async (addressToCheck: string) => {
    try {
      const contract = getRegistryContractRead();
      const isRegistered = await contract.isRegisteredVoter(addressToCheck);
      return isRegistered as boolean;
    } catch (err: any) {
      console.error('Failed to check voter registration:', err);
      return false;
    }
  }, [getRegistryContractRead]);

  const registerVoter = useCallback(async (voterAddress: string, salt: string) => {
    setLoading(true);
    setError('');
    try {
      const contract = getRegistryContract();
      const idHash = ethers.solidityPackedKeccak256(['address', 'string'], [voterAddress, salt]);
      const tx = await contract.registerVoter(voterAddress, idHash);
      await tx.wait();
      return true;
    } catch (err: any) {
      console.error('Registration failed:', err);
      setError(err.reason || err.message || 'Failed to register voter.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getRegistryContract]);

  const registerVotersBatch = useCallback(async (voterAddresses: string[], salt: string) => {
    setLoading(true);
    setError('');
    try {
      const contract = getRegistryContract();
      const idHashes = voterAddresses.map(addr =>
        ethers.solidityPackedKeccak256(['address', 'string'], [addr, salt])
      );
      const tx = await contract.registerVotersBatch(voterAddresses, idHashes);
      await tx.wait();
      return true;
    } catch (err: any) {
      console.error('Batch registration failed:', err);
      setError(err.reason || err.message || 'Failed to batch register voters.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getRegistryContract]);

  // 3. Election Factory Operations
  const createElection = useCallback(async (
    name: string,
    description: string,
    candidateNames: string[],
    candidateParties: string[],
    candidateSymbols: string[],
    startTime: number,
    endTime: number
  ) => {
    setLoading(true);
    setError('');
    try {
      const contract = getFactoryContract();
      const tx = await contract.createElection(
        name,
        description,
        candidateNames,
        candidateParties,
        candidateSymbols,
        startTime,
        endTime
      );
      await tx.wait();
      return true;
    } catch (err: any) {
      console.error('Election creation failed:', err);
      setError(err.reason || err.message || 'Failed to create election.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getFactoryContract]);

  const getElectionsList = useCallback(async () => {
    try {
      const contract = getFactoryContractRead();
      const addresses: string[] = await contract.getAllElections();
      return addresses;
    } catch (err) {
      console.error('Failed to get elections list:', err);
      return [];
    }
  }, [getFactoryContractRead]);

  // 4. Election Operations
  const getElectionDetails = useCallback(async (electionAddress: string): Promise<ElectionDetails | null> => {
    try {
      const contract = getElectionContractRead(electionAddress);
      
      const [info, candidates, isVoted] = await Promise.all([
        contract.getElectionInfo(),
        contract.getAllCandidates(),
        userAddress ? contract.hasVoted(userAddress) : Promise.resolve(false)
      ]);
      
      let results: number[] = [];
      if (info.resultsRevealed) {
        const rawResults = await contract.getResults();
        results = rawResults.map((r: any) => Number(r));
      }

      const now = Math.floor(Date.now() / 1000);
      let status: ElectionDetails['status'] = 'NotStarted';
      if (info.resultsRevealed) {
        status = 'Decrypted';
      } else if (now < Number(info.startTime)) {
        status = 'NotStarted';
      } else if (now >= Number(info.startTime) && now < Number(info.endTime)) {
        status = 'Voting';
      } else {
        status = 'Closed';
      }

      return {
        address: electionAddress,
        electionId: Number(info.electionId),
        name: info.name,
        description: info.description,
        startTime: Number(info.startTime),
        endTime: Number(info.endTime),
        totalVotesCast: Number(info.totalVotesCast),
        candidateCount: Number(info.candidateCount),
        resultsRevealed: info.resultsRevealed,
        commissionAddress: info.commissionAddress,
        candidates: candidates.map((c: any) => ({
          name: c.name,
          party: c.party,
          symbol: c.symbol
        })),
        results,
        isVoted,
        status
      };
    } catch (err) {
      console.error(`Failed to get election details for ${electionAddress}:`, err);
      return null;
    }
  }, [getElectionContractRead, userAddress]);

  const castVote = useCallback(async (
    electionAddress: string,
    choiceIndex: number,
    encryptChoiceFn: (contractAddress: string, voterAddress: string, choiceIndex: number) => Promise<{ handle: string, inputProof: string }>
  ) => {
    setLoading(true);
    setError('');
    try {
      if (!userAddress) throw new Error('Wallet not connected');
      
      // Encrypt voter choice client-side
      const { handle, inputProof } = await encryptChoiceFn(electionAddress, userAddress, choiceIndex);
      
      const contract = getElectionContract(electionAddress);
      const tx = await contract.castVote(handle, inputProof);
      await tx.wait();
      return true;
    } catch (err: any) {
      console.error('Casting vote failed:', err);
      setError(err.reason || err.message || 'Failed to cast vote.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getElectionContract, userAddress]);

  // Request decryption (marks handles as publicly decryptable on-chain)
  const requestRevealResults = useCallback(async (electionAddress: string) => {
    setLoading(true);
    setError('');
    try {
      const contract = getElectionContract(electionAddress);
      const tx = await contract.requestRevealResults();
      await tx.wait();
      return true;
    } catch (err: any) {
      console.error('Requesting reveal failed:', err);
      setError(err.reason || err.message || 'Failed to request reveal.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getElectionContract]);

  // Perform off-chain public decrypt + submit verified decryption proof on-chain
  const decryptAndFinalizeResults = useCallback(async (
    electionAddress: string,
    fhevmInstance: any
  ) => {
    setLoading(true);
    setError('');
    try {
      const contract = getElectionContract(electionAddress);
      
      // 1. Fetch handles from contract
      console.log('Fetching encrypted tally handles...');
      const handles: string[] = await contract.getEncryptedTallyHandles();
      console.log('Handles received:', handles);

      // 2. Perform off-chain threshold decryption via Relayer
      console.log('Decrypting tallies off-chain via KMS Relayer...');
      const results = await fhevmInstance.publicDecrypt(handles);
      console.log('Decryption proof and results received from KMS:', results);

      // 3. Extract cleartext tallies in the exact order of the handles
      const decryptedTallies = handles.map(h => Number(results.clearValues[h]));
      console.log('Decrypted tallies:', decryptedTallies);

      // 4. Submit cleartext and proof back on-chain for signature verification
      console.log('Finalizing results on-chain...');
      const tx = await contract.finalizeRevealResults(decryptedTallies, results.decryptionProof);
      await tx.wait();
      
      console.log('Results finalized successfully on-chain!');
      return true;
    } catch (err: any) {
      console.error('Decryption and finalization failed:', err);
      setError(err.reason || err.message || 'Failed to decrypt and finalize results.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getElectionContract]);

  // Check if current user is factory owner (commission officer)
  const isUserCommissionOfficer = useCallback(async () => {
    if (!userAddress) return false;
    try {
      const contract = getFactoryContractRead();
      const owner = await contract.owner();
      return owner.toLowerCase() === userAddress.toLowerCase();
    } catch (err) {
      console.error('Failed to check factory owner:', err);
      return false;
    }
  }, [getFactoryContractRead, userAddress]);

  // 5. FHE Identity Registry Operations
  const fetchCitizenStatus = useCallback(async (address: string): Promise<CitizenStatus> => {
    try {
      const contract = getIdentityRegistryContractRead();
      const result = await contract.getCitizenStatus(address);
      const statusIndex = Number(result.status);
      const statuses: RequestStatus[] = ['Pending', 'Approved', 'Rejected', 'Expired'];
      return {
        isVerified: result.isVerified,
        isPending: result.isPending,
        isRegistered: result.isRegistered,
        requestId: Number(result.requestId),
        status: statuses[statusIndex] || 'Pending',
        rejectionReason: result.rejectionReason
      };
    } catch (err) {
      console.error('Failed to fetch citizen status:', err);
      return {
        isVerified: false,
        isPending: false,
        isRegistered: false,
        requestId: 0,
        status: 'Pending',
        rejectionReason: ''
      };
    }
  }, [getIdentityRegistryContractRead]);

  const submitIdentityRequest = useCallback(async (
    _formData: IdentityFormData,
    encryptedChunks: any[],
    inputProofs: any[],
    encryptedDocType: any,
    docTypeProof: any,
    commitmentHash: string
  ): Promise<boolean> => {
    setLoading(true);
    setError('');
    try {
      const contract = getIdentityRegistryContract();
      const tx = await contract.submitIdentityRequest(
        encryptedChunks,
        inputProofs,
        encryptedDocType,
        docTypeProof,
        ethers.hexlify(commitmentHash)
      );
      await tx.wait();
      return true;
    } catch (err: any) {
      console.error('Failed to submit identity request:', err);
      setError(err.reason || err.message || 'Failed to submit identity request.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getIdentityRegistryContract]);

  const resubmitIdentityRequest = useCallback(async (
    _formData: IdentityFormData,
    encryptedChunks: any[],
    inputProofs: any[],
    encryptedDocType: any,
    docTypeProof: any,
    commitmentHash: string
  ): Promise<boolean> => {
    setLoading(true);
    setError('');
    try {
      const contract = getIdentityRegistryContract();
      const tx = await contract.resubmitIdentityRequest(
        encryptedChunks,
        inputProofs,
        encryptedDocType,
        docTypeProof,
        ethers.hexlify(commitmentHash)
      );
      await tx.wait();
      return true;
    } catch (err: any) {
      console.error('Failed to resubmit identity request:', err);
      setError(err.reason || err.message || 'Failed to resubmit identity request.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getIdentityRegistryContract]);

  const fetchPendingRequests = useCallback(async (): Promise<IdentityRequest[]> => {
    try {
      const contract = getIdentityRegistryContractRead();
      const raw = await contract.getPendingRequests();
      const statuses: RequestStatus[] = ['Pending', 'Approved', 'Rejected', 'Expired'];
      return raw.map((r: any) => ({
        requestId: Number(r.requestId),
        citizen: r.citizen,
        submittedAt: Number(r.submittedAt),
        docChunkCount: Number(r.docChunkCount),
        status: statuses[Number(r.status)] || 'Pending',
        rejectionReason: r.rejectionReason,
        commitmentHash: r.commitmentHash
      }));
    } catch (err) {
      console.error('Failed to fetch pending requests:', err);
      return [];
    }
  }, [getIdentityRegistryContractRead]);

  const fetchAllRequests = useCallback(async (): Promise<IdentityRequest[]> => {
    try {
      const contract = getIdentityRegistryContractRead();
      const raw = await contract.getAllRequests();
      const statuses: RequestStatus[] = ['Pending', 'Approved', 'Rejected', 'Expired'];
      return raw.map((r: any) => ({
        requestId: Number(r.requestId),
        citizen: r.citizen,
        submittedAt: Number(r.submittedAt),
        docChunkCount: Number(r.docChunkCount),
        status: statuses[Number(r.status)] || 'Pending',
        rejectionReason: r.rejectionReason,
        commitmentHash: r.commitmentHash
      }));
    } catch (err) {
      console.error('Failed to fetch all requests:', err);
      return [];
    }
  }, [getIdentityRegistryContractRead]);

  const approveIdentityRequest = useCallback(async (requestId: number): Promise<boolean> => {
    setLoading(true);
    setError('');
    try {
      const contract = getIdentityRegistryContract();
      const tx = await contract.approveIdentityRequest(requestId);
      await tx.wait();
      return true;
    } catch (err: any) {
      console.error('Failed to approve identity request:', err);
      setError(err.reason || err.message || 'Failed to approve request.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getIdentityRegistryContract]);

  const rejectIdentityRequest = useCallback(async (requestId: number, reason: string): Promise<boolean> => {
    setLoading(true);
    setError('');
    try {
      const contract = getIdentityRegistryContract();
      const tx = await contract.rejectIdentityRequest(requestId, reason);
      await tx.wait();
      return true;
    } catch (err: any) {
      console.error('Failed to reject identity request:', err);
      setError(err.reason || err.message || 'Failed to reject request.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [getIdentityRegistryContract]);

  const decryptIdentityDocument = useCallback(async (
    requestId: number,
    docChunkCount: number,
    fhevmInstance: any
  ): Promise<{ docType: number; documentContent: string } | null> => {
    if (!signer || !userAddress || !fhevmInstance) {
      throw new Error('Signer, address, or FHEVM instance not available.');
    }
    setLoading(true);
    setError('');
    try {
      const contract = getIdentityRegistryContractRead();

      // 1. Fetch encrypted type handle
      console.log('Fetching encrypted document type handle...');
      const typeHandleRaw = await contract.getEncryptedDocType(requestId);
      const typeHandle = ethers.hexlify(typeHandleRaw);
      console.log('Document type handle:', typeHandle);

      // 2. Fetch encrypted chunk handles
      console.log('Fetching encrypted document chunk handles...');
      const chunkHandles: string[] = [];
      for (let i = 0; i < docChunkCount; i++) {
        const chunkHandleRaw = await contract.getEncryptedDocChunk(requestId, i);
        chunkHandles.push(ethers.hexlify(chunkHandleRaw));
      }
      console.log('Document chunk handles:', chunkHandles);

      // 3. Generate KMS re-encryption keypair
      console.log('Generating KMS keypair for userDecrypt...');
      const keypair = fhevmInstance.generateKeypair();

      // 4. Request user signature on typed data
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 1;
      const contractAddresses = [FHE_IDENTITY_REGISTRY_ADDRESS];

      console.log('Creating EIP712 signature request...');
      const eip712 = fhevmInstance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimestamp,
        durationDays
      );

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );
      console.log('Signature received.');

      // 5. Query relayer gateway for userDecrypt
      console.log('Querying KMS relayer to decrypt handles...');
      const handlePairs = [
        { handle: typeHandle, contractAddress: FHE_IDENTITY_REGISTRY_ADDRESS },
        ...chunkHandles.map(h => ({ handle: h, contractAddress: FHE_IDENTITY_REGISTRY_ADDRESS }))
      ];

      const decryptResults = await fhevmInstance.userDecrypt(
        handlePairs,
        keypair.privateKey,
        keypair.publicKey,
        signature,
        contractAddresses,
        userAddress,
        startTimestamp,
        durationDays
      );
      console.log('KMS decryption values received:', decryptResults);

      // 6. Decode values
      const docType = Number(decryptResults[typeHandle]);

      const decodedChunks: string[] = [];
      const decoder = new TextDecoder();
      
      for (const h of chunkHandles) {
        const bigintVal = BigInt(decryptResults[h]);
        
        // Reconstruct Uint8Array from bigint
        const chunkBytes = new Uint8Array(32);
        let temp = bigintVal;
        for (let j = 31; j >= 0; j--) {
          chunkBytes[j] = Number(temp & 255n);
          temp >>= 8n;
        }
        
        // Remove trailing null bytes (padding)
        let actualLength = 32;
        while (actualLength > 0 && chunkBytes[actualLength - 1] === 0) {
          actualLength--;
        }
        
        const chunkString = decoder.decode(chunkBytes.slice(0, actualLength));
        decodedChunks.push(chunkString);
      }

      const documentContent = decodedChunks.join('');
      console.log('Decrypted document content successfully:', documentContent);
      return { docType, documentContent };
    } catch (err: any) {
      console.error('Failed to decrypt identity document:', err);
      setError(err.reason || err.message || 'Decryption failed.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [signer, userAddress, getIdentityRegistryContractRead]);

  return {
    loading,
    error,
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
    decryptIdentityDocument
  };
}
