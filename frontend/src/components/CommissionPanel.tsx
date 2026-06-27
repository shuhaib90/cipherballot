import { useState, useEffect, useCallback } from 'react';
import {
  PlusCircle,
  UserPlus,
  Users,
  ShieldAlert,
  Calendar,
  Plus,
  Trash2,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lock,
  X
} from 'lucide-react';
import { ethers } from 'ethers';
import type { IdentityRequest } from '../utils/types';

interface CommissionPanelProps {
  isOfficer: boolean;
  onRegisterVoter: (address: string, salt: string) => Promise<boolean>;
  onRegisterVotersBatch: (addresses: string[], salt: string) => Promise<boolean>;
  onCreateElection: (
    name: string,
    description: string,
    candidateNames: string[],
    candidateParties: string[],
    candidateSymbols: string[],
    startTime: number,
    endTime: number
  ) => Promise<boolean>;
  fetchPendingRequests: () => Promise<IdentityRequest[]>;
  fetchAllRequests: () => Promise<IdentityRequest[]>;
  approveIdentityRequest: (requestId: number) => Promise<boolean>;
  rejectIdentityRequest: (requestId: number, reason: string) => Promise<boolean>;
  loading: boolean;
  error: string;
  fhevmInstance: any;
  decryptIdentityDocument: (
    requestId: number,
    docChunkCount: number,
    fhevmInstance: any
  ) => Promise<{ docType: number; documentContent: string } | null>;
  appointCommissioner: (address: string) => Promise<boolean>;
  delegateRequestAccess: (requestId: number, target: string) => Promise<boolean>;
  fetchCommissionersList: () => Promise<string[]>;
}

export function CommissionPanel({
  isOfficer,
  onRegisterVoter,
  onRegisterVotersBatch,
  onCreateElection,
  fetchPendingRequests,
  fetchAllRequests,
  approveIdentityRequest,
  rejectIdentityRequest,
  loading,
  error,
  fhevmInstance,
  decryptIdentityDocument,
  appointCommissioner,
  delegateRequestAccess,
  fetchCommissionersList
}: CommissionPanelProps) {
  // Identity Requests Queue states
  const [pendingRequests, setPendingRequests] = useState<IdentityRequest[]>([]);
  const [allRequests, setAllRequests] = useState<IdentityRequest[]>([]);
  const [loadingReqs, setLoadingReqs] = useState<boolean>(false);

  // FHE Decryption states
  const [decryptedDocs, setDecryptedDocs] = useState<Record<number, { docType: string; content: string }>>({});
  const [decryptingReqId, setDecryptingReqId] = useState<number | null>(null);

  const handleDecryptDoc = async (requestId: number, docChunkCount: number) => {
    if (!fhevmInstance) {
      alert('FHEVM SDK is not fully loaded yet. Please wait.');
      return;
    }
    setDecryptingReqId(requestId);
    try {
      const res = await decryptIdentityDocument(requestId, docChunkCount, fhevmInstance);
      if (res) {
        const docTypesMap: Record<number, string> = {
          1: 'National ID',
          2: 'Passport',
          3: 'Voter Card',
          4: 'Driving License'
        };
        setDecryptedDocs(prev => ({
          ...prev,
          [requestId]: {
            docType: docTypesMap[res.docType] || 'Unknown',
            content: res.documentContent
          }
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDecryptingReqId(null);
    }
  };

  // Commissioners list & appointment states
  const [commissioners, setCommissioners] = useState<string[]>([]);
  const [newCommissionerAddr, setNewCommissionerAddr] = useState<string>('');
  const [appointing, setAppointing] = useState<boolean>(false);
  const [delegatingReqId, setDelegatingReqId] = useState<number | null>(null);
  const [selectedTargetComm, setSelectedTargetComm] = useState<Record<number, string>>({});

  const handleAppointCommissioner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommissionerAddr || !ethers.isAddress(newCommissionerAddr)) {
      alert('Please enter a valid Ethereum address.');
      return;
    }
    setAppointing(true);
    try {
      const success = await appointCommissioner(newCommissionerAddr);
      if (success) {
        alert(`Successfully appointed ${newCommissionerAddr} as a Commissioner!`);
        setNewCommissionerAddr('');
        const list = await fetchCommissionersList();
        setCommissioners(list);
      } else {
        alert('Failed to appoint commissioner. Check if you have owner permissions.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAppointing(false);
    }
  };

  const handleDelegateAccess = async (requestId: number) => {
    const target = selectedTargetComm[requestId];
    if (!target) {
      alert('Please select a target commissioner.');
      return;
    }
    setDelegatingReqId(requestId);
    try {
      const success = await delegateRequestAccess(requestId, target);
      if (success) {
        alert(`Successfully delegated FHE decryption access to ${target} for Request #${requestId}!`);
      } else {
        alert('Failed to delegate FHE access.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDelegatingReqId(null);
    }
  };

  // Collapsible section states
  const [collapsedApproved, setCollapsedApproved] = useState<boolean>(true);
  const [collapsedRejected, setCollapsedRejected] = useState<boolean>(true);

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | null;
    request: IdentityRequest | null;
  }>({
    isOpen: false,
    action: null,
    request: null
  });
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('');

  // Single Voter state
  const [singleAddress, setSingleAddress] = useState<string>('');
  const [singleSalt, setSingleSalt] = useState<string>('VOTER_SALT');
  
  // Batch Voter state
  const [batchCsv, setBatchCsv] = useState<string>('');
  const [batchSalt, setBatchSalt] = useState<string>('VOTER_SALT');

  // Election Form state
  const [elecName, setElecName] = useState<string>('');
  const [elecDesc, setElecDesc] = useState<string>('');
  const [startMin, setStartMin] = useState<number>(5); // starts in X minutes
  const [durationMin, setDurationMin] = useState<number>(60); // lasts for X minutes

  // Candidates list state
  const [candidates, setCandidates] = useState<Array<{ name: string; party: string; symbol: string }>>([
    { name: 'Priya Nair', party: 'Development Party', symbol: '🌱' },
    { name: 'Rajan Menon', party: 'Progress Alliance', symbol: '⚡' }
  ]);

  // Load and sync identity requests
  const loadRequests = useCallback(async () => {
    if (!isOfficer) return;
    setLoadingReqs(true);
    try {
      const [pending, all, list] = await Promise.all([
        fetchPendingRequests(),
        fetchAllRequests(),
        fetchCommissionersList()
      ]);
      setPendingRequests(pending);
      setAllRequests(all);
      setCommissioners(list);
    } catch (err) {
      console.error('Failed to load identity requests:', err);
    } finally {
      setLoadingReqs(false);
    }
  }, [isOfficer, fetchPendingRequests, fetchAllRequests, fetchCommissionersList]);

  useEffect(() => {
    if (isOfficer) {
      loadRequests();
    }
  }, [isOfficer, loadRequests]);

  if (!isOfficer) {
    return (
      <div className="glass-panel p-8 text-center max-w-xl mx-auto space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-lg">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h3 className="text-xl font-bold font-sans text-slate-100">Restricted Access</h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          This panel is reserved exclusively for the Election Commission. Connect the officer wallet `0x36e1C1EbC3e36d9b55E4b872A74B6F059008789e` to register voters and manage elections.
        </p>
      </div>
    );
  }

  // Identity Queue Action Handlers
  const handleApproveClick = (req: IdentityRequest) => {
    setConfirmModal({
      isOpen: true,
      action: 'approve',
      request: req
    });
  };

  const handleRejectClick = (req: IdentityRequest) => {
    setRejectReasonInput('');
    setConfirmModal({
      isOpen: true,
      action: 'reject',
      request: req
    });
  };

  const handleConfirmAction = async () => {
    const { action, request } = confirmModal;
    if (!request || !action) return;

    let success = false;
    if (action === 'approve') {
      success = await approveIdentityRequest(request.requestId);
    } else if (action === 'reject') {
      if (rejectReasonInput.length < 10) {
        alert('Rejection reason must be at least 10 characters.');
        return;
      }
      success = await rejectIdentityRequest(request.requestId, rejectReasonInput);
    }

    if (success) {
      setConfirmModal({ isOpen: false, action: null, request: null });
      setRejectReasonInput('');
      await loadRequests();
    }
  };

  // Original Registration Handlers
  const handleAddCandidate = () => {
    if (candidates.length >= 10) return;
    setCandidates([...candidates, { name: '', party: '', symbol: '🗳️' }]);
  };

  const handleRemoveCandidate = (index: number) => {
    if (candidates.length <= 2) return;
    setCandidates(candidates.filter((_, idx) => idx !== index));
  };

  const handleCandidateChange = (index: number, field: 'name' | 'party' | 'symbol', value: string) => {
    const updated = [...candidates];
    updated[index][field] = value;
    setCandidates(updated);
  };

  const handleSingleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleAddress) return;
    const success = await onRegisterVoter(singleAddress, singleSalt);
    if (success) {
      setSingleAddress('');
    }
  };

  const handleBatchRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCsv) return;
    
    const addresses = batchCsv
      .split(/[\n,]+/)
      .map(addr => addr.trim())
      .filter(addr => ethers.isAddress(addr));

    if (addresses.length === 0) {
      alert('No valid addresses found in the list.');
      return;
    }

    const success = await onRegisterVotersBatch(addresses, batchSalt);
    if (success) {
      setBatchCsv('');
    }
  };

  const handleCreateElectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!elecName || candidates.some(c => !c.name || !c.party)) {
      alert('Please fill all election details and candidate fields.');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const startTime = now + startMin * 60;
    const endTime = startTime + durationMin * 60;

    const names = candidates.map(c => c.name);
    const parties = candidates.map(c => c.party);
    const symbols = candidates.map(c => c.symbol || '🗳️');

    const success = await onCreateElection(
      elecName,
      elecDesc,
      names,
      parties,
      symbols,
      startTime,
      endTime
    );

    if (success) {
      setElecName('');
      setElecDesc('');
      setCandidates([
        { name: 'Priya Nair', party: 'Development Party', symbol: '🌱' },
        { name: 'Rajan Menon', party: 'Progress Alliance', symbol: '⚡' }
      ]);
      alert('Election created successfully on-chain!');
    }
  };

  const approvedRequests = allRequests.filter(r => r.status === 'Approved');
  const rejectedRequests = allRequests.filter(r => r.status === 'Rejected');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-100 font-sans">Election Commission Panel</h2>
          <p className="text-xs text-slate-400 mt-1">Configure voter registers, verify secure identity proofs, and deploy new cryptographic elections.</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Commission Authorized
        </div>
      </div>

      {/* SECTION 0: Identity Verification Queue */}
      <div className="glass-panel p-6 space-y-5 border-indigo-500/10">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
            <Lock className="h-4.5 w-4.5 text-indigo-400" />
            Confidential Identity Verification Queue
          </h3>
          <button
            onClick={loadRequests}
            disabled={loadingReqs}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition disabled:opacity-50 shrink-0"
            title="Refresh Verification Queue"
          >
            <RefreshCw className={`h-4 w-4 ${loadingReqs ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadingReqs ? (
          <div className="text-center py-8 text-slate-500 flex items-center justify-center gap-2 text-xs font-semibold">
            <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
            Loading verification queue...
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-medium border border-dashed border-slate-800 rounded-xl">
            No pending voter registration requests.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            {pendingRequests.map((req) => (
              <div key={req.requestId} className="bg-slate-900/40 border border-slate-850 rounded-xl p-4 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300 font-sans">Request ID: #{req.requestId}</span>
                    <span className="px-2.5 py-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md uppercase tracking-wider flex items-center gap-1">
                      <span className="h-1 w-1 rounded-full bg-amber-400 animate-ping"></span>
                      Pending Review
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Citizen Wallet</span>
                      <div className="flex items-center justify-between gap-2 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-900 font-mono text-[10.5px] text-slate-300">
                        <span className="truncate">{req.citizen}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(req.citizen);
                            alert('Copied wallet address!');
                          }}
                          className="text-[10px] text-indigo-450 hover:text-indigo-350 font-bold transition"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-slate-400 pt-1">
                      <span>Submitted:</span>
                      <span className="font-semibold text-slate-350">
                        {new Date(req.submittedAt * 1000).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Data Size:</span>
                      <span className="font-semibold text-slate-350">{req.docChunkCount} chunks ({req.docChunkCount * 32} bytes)</span>
                    </div>

                    <div className="flex flex-col gap-1 pt-1">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Commitment Hash</span>
                      <div className="bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-900 font-mono text-[10.5px] text-slate-400 truncate">
                        {req.commitmentHash}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-900/60 mt-2">
                      {decryptedDocs[req.requestId] ? (
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5 space-y-2 text-xs">
                          <span className="font-bold text-emerald-400 uppercase text-[9.5px] tracking-wider block">Decrypted Citizen Document</span>
                          <div className="grid grid-cols-2 gap-2 text-slate-400">
                            <span>Document Type:</span>
                            <span className="font-semibold text-slate-200">{decryptedDocs[req.requestId].docType}</span>
                          </div>
                          <div className="flex flex-col gap-1 pt-1.5 border-t border-emerald-500/10">
                            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Document Contents</span>
                            <p className="bg-slate-950 p-2.5 rounded-lg border border-slate-900 font-mono text-[10.5px] text-emerald-300 break-all whitespace-pre-wrap leading-relaxed">
                              {decryptedDocs[req.requestId].content}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDecryptDoc(req.requestId, req.docChunkCount)}
                          disabled={decryptingReqId !== null}
                          className="btn-secondary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 border border-yellow-500/10 bg-[#070414]/30 hover:border-yellow-500/30"
                        >
                          {decryptingReqId === req.requestId ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin text-yellow-400" />
                              Decrypting via KMS...
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5 text-yellow-400" />
                              Decrypt & View Document
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Delegate FHE Decryption Access Section */}
                    <div className="flex flex-col gap-1.5 pt-2.5 border-t border-slate-900/60 mt-1">
                      <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Delegate FHE Decryption Access</span>
                      <div className="flex gap-2">
                        <select
                          value={selectedTargetComm[req.requestId] || ''}
                          onChange={(e) => setSelectedTargetComm(prev => ({ ...prev, [req.requestId]: e.target.value }))}
                          className="bg-slate-950 px-2.5 py-2 rounded-xl border border-slate-900 text-xs text-slate-350 font-sans focus:outline-none flex-1"
                        >
                          <option value="">Select Commissioner...</option>
                          {commissioners.map((commAddress, idx) => (
                            <option key={commAddress + idx} value={commAddress}>
                              {commAddress.substring(0, 6)}...{commAddress.substring(commAddress.length - 4)}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={delegatingReqId === req.requestId || !selectedTargetComm[req.requestId]}
                          onClick={() => handleDelegateAccess(req.requestId)}
                          className="px-3.5 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-[#FFD208] text-xs font-bold hover:bg-yellow-500/20 disabled:opacity-50 disabled:hover:bg-yellow-500/10 transition duration-150 shrink-0"
                        >
                          {delegatingReqId === req.requestId ? 'Sharing...' : 'Share Key'}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-slate-900/60">
                  <button
                    onClick={() => handleRejectClick(req)}
                    className="flex-1 py-2 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/30 text-rose-455 font-bold text-xs transition duration-155"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApproveClick(req)}
                    className="flex-1 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 text-emerald-455 font-bold text-xs transition duration-155"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Collapsible lists for Approved and Rejected Requests */}
        <div className="space-y-3 pt-3">
          {/* Approved Requests Collapsible */}
          <div className="border border-slate-900 rounded-xl overflow-hidden">
            <button
              onClick={() => setCollapsedApproved(!collapsedApproved)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-900/20 hover:bg-slate-900/40 text-xs font-bold text-slate-400 transition duration-150"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
                Approved Requests ({approvedRequests.length})
              </span>
              {collapsedApproved ? <ChevronDown className="h-4.5 w-4.5 text-slate-500" /> : <ChevronUp className="h-4.5 w-4.5 text-slate-500" />}
            </button>

            {!collapsedApproved && (
              <div className="p-4 bg-slate-950/20 border-t border-slate-900 space-y-3 max-h-64 overflow-y-auto">
                {approvedRequests.length === 0 ? (
                  <div className="text-center py-4 text-slate-650 text-[11px] font-medium">
                    No approved requests yet.
                  </div>
                ) : (
                  approvedRequests.map(req => (
                    <div key={req.requestId} className="flex justify-between items-center bg-slate-900/10 border border-slate-900/60 rounded-xl p-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-300">Request #{req.requestId}</span>
                          <span className="font-mono text-[10.5px] text-slate-450">{req.citizen}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">Approved & Auto-Registered</p>
                      </div>
                      <span className="px-2 py-0.5 text-[8.5px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase">
                        Approved
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Rejected Requests Collapsible */}
          <div className="border border-slate-900 rounded-xl overflow-hidden">
            <button
              onClick={() => setCollapsedRejected(!collapsedRejected)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-900/20 hover:bg-slate-900/40 text-xs font-bold text-slate-400 transition duration-150"
            >
              <span className="flex items-center gap-2">
                <ShieldAlert className="h-4.5 w-4.5 text-rose-450" />
                Rejected Requests ({rejectedRequests.length})
              </span>
              {collapsedRejected ? <ChevronDown className="h-4.5 w-4.5 text-slate-500" /> : <ChevronUp className="h-4.5 w-4.5 text-slate-500" />}
            </button>

            {!collapsedRejected && (
              <div className="p-4 bg-slate-950/20 border-t border-slate-900 space-y-3 max-h-64 overflow-y-auto">
                {rejectedRequests.length === 0 ? (
                  <div className="text-center py-4 text-slate-650 text-[11px] font-medium">
                    No rejected requests yet.
                  </div>
                ) : (
                  rejectedRequests.map(req => (
                    <div key={req.requestId} className="bg-slate-900/10 border border-slate-900/60 rounded-xl p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-300">Request #{req.requestId}</span>
                          <span className="font-mono text-[10.5px] text-slate-450">{req.citizen}</span>
                        </div>
                        <span className="px-2 py-0.5 text-[8.5px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded uppercase">
                          Rejected
                        </span>
                      </div>
                      <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 text-[11px] text-rose-300">
                        <span className="font-bold block text-[9.5px] uppercase tracking-wide text-rose-400/80 mb-1">Reason</span>
                        {req.rejectionReason}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 0.5: Commission Officers & Appointment */}
      <div className="glass-panel p-6 space-y-5 border-yellow-500/10">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3">
          <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
            <Users className="h-4.5 w-4.5 text-[#FFD208]" />
            Commission Officers & Appointment
          </h3>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Appointment Form */}
          <form onSubmit={handleAppointCommissioner} className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Appoint New Commissioner</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Enter the wallet address of the officer you want to appoint. Appointed commissioners will gain access to the Commission Panel and the ability to review and verify voters.
              </p>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Wallet Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={newCommissionerAddr}
                  onChange={(e) => setNewCommissionerAddr(e.target.value)}
                  className="input-field mt-1"
                />
              </div>
              
              <button
                type="submit"
                disabled={appointing || !newCommissionerAddr}
                className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
              >
                {appointing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Appointing...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Appoint Commissioner
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Active Commissioners List */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-bold text-slate-200">Active Commissioners</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Below is the list of wallets currently authorized to perform Election Commission operations.
              </p>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {commissioners.map((commAddress, idx) => (
                <div key={commAddress + idx} className="flex items-center justify-between gap-3 bg-slate-950 px-3 py-2.5 rounded-xl border border-slate-900 font-mono text-[11px] text-slate-350">
                  <div className="flex items-center gap-2 truncate">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0"></span>
                    <span className="truncate">{commAddress}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(commAddress);
                      alert('Copied commissioner address!');
                    }}
                    className="text-[10px] text-[#FFD208] hover:text-yellow-300 font-bold transition shrink-0"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Commission Operations Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Voter Registration Panel */}
        <div className="space-y-6">
          {/* Single Register Card */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
              <UserPlus className="h-4.5 w-4.5 text-indigo-400" />
              Register Single Voter
            </h3>
            
            <form onSubmit={handleSingleRegister} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Voter Wallet Address
                </label>
                <input
                  type="text"
                  required
                  value={singleAddress}
                  onChange={(e) => setSingleAddress(e.target.value)}
                  placeholder="0x..."
                  className="input-field text-xs"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Secret Salt (For Voter Hash Generation)
                </label>
                <input
                  type="text"
                  value={singleSalt}
                  onChange={(e) => setSingleSalt(e.target.value)}
                  placeholder="VOTER_SALT"
                  className="input-field text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-2.5 text-xs font-bold"
              >
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                Register Voter
              </button>
            </form>
          </div>

          {/* Batch Register Card */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-indigo-400" />
              Batch Register Wallet Addresses
            </h3>
            <p className="text-[10.5px] text-slate-400 leading-normal">
              Input comma-separated or newline-separated Ethereum wallet addresses. The registry automatically registers their hashed identities.
            </p>

            <form onSubmit={handleBatchRegister} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Voter Addresses List
                </label>
                <textarea
                  required
                  rows={4}
                  value={batchCsv}
                  onChange={(e) => setBatchCsv(e.target.value)}
                  placeholder="0xAddress1,&#10;0xAddress2,&#10;0xAddress3"
                  className="input-field text-xs font-mono resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Common Salt
                </label>
                <input
                  type="text"
                  value={batchSalt}
                  onChange={(e) => setBatchSalt(e.target.value)}
                  placeholder="VOTER_SALT"
                  className="input-field text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-secondary w-full py-2.5 text-xs font-bold border border-slate-700/60"
              >
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                Register Batch
              </button>
            </form>
          </div>
        </div>

        {/* Election Creation Panel */}
        <div className="glass-panel p-6 space-y-5">
          <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
            <PlusCircle className="h-4.5 w-4.5 text-indigo-400" />
            Deploy New Election
          </h3>

          <form onSubmit={handleCreateElectionSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Election Name
              </label>
              <input
                type="text"
                required
                value={elecName}
                onChange={(e) => setElecName(e.target.value)}
                placeholder="e.g. General Election 2026"
                className="input-field text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Election Description
              </label>
              <input
                type="text"
                required
                value={elecDesc}
                onChange={(e) => setElecDesc(e.target.value)}
                placeholder="Confidential general election description"
                className="input-field text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Starts In (Minutes)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={startMin}
                  onChange={(e) => setStartMin(Number(e.target.value))}
                  className="input-field text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Duration (Minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  required
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  className="input-field text-xs"
                />
              </div>
            </div>

            {/* Candidates Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Candidates List</span>
                <button
                  type="button"
                  onClick={handleAddCandidate}
                  disabled={candidates.length >= 10}
                  className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase transition"
                >
                  <Plus className="h-3 w-3" /> Add Candidate
                </button>
              </div>

              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {candidates.map((cand, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      required
                      value={cand.symbol}
                      onChange={(e) => handleCandidateChange(idx, 'symbol', e.target.value)}
                      placeholder="Symbol"
                      className="w-12 px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm focus:outline-none focus:border-indigo-500 shrink-0 text-slate-100"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Candidate Name"
                      value={cand.name}
                      onChange={(e) => handleCandidateChange(idx, 'name', e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-100"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Party Name"
                      value={cand.party}
                      onChange={(e) => handleCandidateChange(idx, 'party', e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveCandidate(idx)}
                      disabled={candidates.length <= 2}
                      className="p-2 bg-slate-900 border border-slate-850 rounded-xl text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed shrink-0 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 mt-4 text-xs font-bold"
            >
              {loading ? <RefreshCw className="h-4.5 w-4.5 animate-spin" /> : <Calendar className="h-4.5 w-4.5" />}
              Deploy Cryptographic Election on EVM
            </button>
          </form>
        </div>
      </div>
      
      {error && (
        <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs text-rose-400 font-medium">
          {error}
        </div>
      )}

      {/* ConfirmModal Overlay */}
      {confirmModal.isOpen && confirmModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md px-4">
          <div className="glass-panel w-full max-w-md p-6 space-y-5 border-slate-800 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setConfirmModal({ isOpen: false, action: null, request: null })}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition p-1 hover:bg-slate-900 rounded-lg"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${
                confirmModal.action === 'approve'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'border-rose-500/20 bg-rose-500/10 text-rose-400'
              }`}>
                {confirmModal.action === 'approve' ? (
                  <ShieldCheck className="h-6 w-6" />
                ) : (
                  <AlertTriangle className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold font-sans text-slate-100">
                  {confirmModal.action === 'approve' ? 'Approve Identity Request' : 'Reject Identity Request'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Request ID: #{confirmModal.request.requestId}</p>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 space-y-2.5 text-xs text-slate-350">
              <div className="flex justify-between gap-4">
                <span className="text-slate-450 font-medium">Citizen Wallet:</span>
                <span className="font-mono text-slate-300 font-semibold truncate max-w-[200px]">
                  {confirmModal.request.citizen}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-450 font-medium">Submitted At:</span>
                <span className="text-slate-305 font-semibold">
                  {new Date(confirmModal.request.submittedAt * 1000).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-450 font-medium">Commitment Hash:</span>
                <span className="font-mono text-slate-400 font-semibold truncate max-w-[200px]">
                  {confirmModal.request.commitmentHash}
                </span>
              </div>
            </div>

            {confirmModal.action === 'reject' && (
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Rejection Reason <span className="text-rose-455">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  placeholder="Provide a detailed rejection reason (minimum 10 characters)..."
                  className="input-field text-xs resize-none leading-relaxed text-slate-100"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-semibold">
                  <span>Must be at least 10 characters</span>
                  <span className={rejectReasonInput.length >= 10 ? 'text-emerald-450' : 'text-rose-400'}>
                    {rejectReasonInput.length} chars
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, action: null, request: null })}
                className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 font-semibold rounded-xl text-xs transition duration-150"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={loading || (confirmModal.action === 'reject' && rejectReasonInput.length < 10)}
                className={`px-4 py-2 text-white font-bold rounded-xl text-xs transition duration-155 flex items-center gap-1.5 ${
                  confirmModal.action === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40'
                    : 'bg-rose-600 hover:bg-rose-500 disabled:opacity-40'
                }`}
              >
                {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
                {confirmModal.action === 'approve' ? 'Approve & Register' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
