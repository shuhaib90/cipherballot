// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint256, euint8, ebool,
        externalEuint256,
        externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from
    "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from
    "@openzeppelin/contracts/access/Ownable.sol";
import "./VoterRegistry.sol";
import "./VoterEligibilityPass.sol";

contract FHEIdentityRegistry is
    ZamaEthereumConfig,
    Ownable
{
    // ─── Constants ───────────────────────────────────
    uint256 public constant MAX_DOC_CHUNKS = 10;
    uint256 public constant REQUEST_EXPIRY = 30 days;

    // ─── Document Types ───────────────────────────────
    // Citizens choose which document they submit
    // Stored as encrypted uint8 on-chain
    // 1 = National ID, 2 = Passport,
    // 3 = Voter Card, 4 = Driving License
    uint8 public constant DOC_NATIONAL_ID   = 1;
    uint8 public constant DOC_PASSPORT      = 2;
    uint8 public constant DOC_VOTER_CARD    = 3;
    uint8 public constant DOC_DRIVING_LICENSE = 4;

    // ─── Identity Request ─────────────────────────────
    struct IdentityRequest {
        address citizen;          // wallet address
        uint256 submittedAt;      // timestamp
        uint256 requestId;        // unique ID
        uint8   docChunkCount;    // how many chunks
        RequestStatus status;
        string  rejectionReason;  // empty if approved
        bytes32 commitmentHash;   // keccak256 of full doc
                                  // for integrity proof
    }

    enum RequestStatus {
        Pending,
        Approved,
        Rejected,
        Expired
    }

    // ─── Encrypted Storage ────────────────────────────
    // Document stored as encrypted chunks
    // Only Commission can decrypt via ACL
    mapping(uint256 => euint256[]) private encryptedDocChunks;
    mapping(uint256 => euint8)     private encryptedDocType;

    // Request metadata (public — not sensitive)
    mapping(uint256 => IdentityRequest) public requests;
    mapping(address => uint256) public citizenRequestId;
    mapping(address => bool) public hasPendingRequest;
    mapping(address => bool) public isVerifiedCitizen;

    uint256[] public pendingRequestIds;
    uint256[] public allRequestIds;
    uint256 public requestCount;

    VoterRegistry public immutable voterRegistry;
    VoterEligibilityPass public voterPassContract;
    address public commission;
    
    mapping(address => bool) public isCommissioner;
    address[] public commissioners;

    // ─── Events ───────────────────────────────────────
    event IdentityRequestSubmitted(
        uint256 indexed requestId,
        address indexed citizen,
        uint8   chunkCount,
        uint256 timestamp
    );
    event IdentityRequestApproved(
        uint256 indexed requestId,
        address indexed citizen,
        address indexed approver,
        uint256 timestamp
    );
    event IdentityRequestRejected(
        uint256 indexed requestId,
        address indexed citizen,
        address indexed rejector,
        string  reason,
        uint256 timestamp
    );
    event VoterAutoRegistered(
        uint256 indexed requestId,
        address indexed citizen,
        uint256 timestamp
    );
    event CommissionChanged(
        address indexed oldCommission,
        address indexed newCommission
    );

    // ─── Modifiers ────────────────────────────────────
    modifier onlyCommission() {
        require(
            msg.sender == commission || isCommissioner[msg.sender],
            "Only Election Commission"
        );
        _;
    }

    // ─── Constructor ─────────────────────────────────
    constructor(
        address _voterRegistry,
        address _commission,
        address _voterPass
    ) Ownable(msg.sender) {
        require(_voterRegistry != address(0), "Invalid registry");
        require(_commission != address(0), "Invalid commission");
        require(_voterPass != address(0), "Invalid pass");
        voterRegistry = VoterRegistry(_voterRegistry);
        voterPassContract = VoterEligibilityPass(_voterPass);
        commission    = _commission;
        isCommissioner[_commission] = true;
        commissioners.push(_commission);
    }

    function setVoterPassContract(address _voterPass) external onlyOwner {
        require(_voterPass != address(0), "Invalid address");
        voterPassContract = VoterEligibilityPass(_voterPass);
    }

    // ─────────────────────────────────────────────────
    // CITIZEN: SUBMIT IDENTITY REQUEST
    // ─────────────────────────────────────────────────

    // Citizens call this to submit encrypted documents
    // All document data is encrypted client-side
    // Commission can decrypt via FHE.allow grants below

    function submitIdentityRequest(
        externalEuint256[] calldata encryptedChunks,
        bytes[]            calldata inputProofs,
        externalEuint8             encryptedDocTypeVal,
        bytes              calldata docTypeProof,
        bytes32                    commitmentHash
    ) external {
        _submit(
            msg.sender,
            encryptedChunks,
            inputProofs,
            encryptedDocTypeVal,
            docTypeProof,
            commitmentHash
        );
    }

    function _submit(
        address citizen,
        externalEuint256[] calldata encryptedChunks,
        bytes[]            calldata inputProofs,
        externalEuint8             encryptedDocTypeVal,
        bytes              calldata docTypeProof,
        bytes32                    commitmentHash
    ) internal {
        require(
            !isVerifiedCitizen[citizen],
            "Already verified"
        );
        require(
            !voterRegistry.isRegisteredVoter(citizen),
            "Already registered voter"
        );
        require(
            !hasPendingRequest[citizen],
            "Request already pending"
        );
        require(
            encryptedChunks.length > 0,
            "No document data"
        );
        require(
            encryptedChunks.length <= MAX_DOC_CHUNKS,
            "Document too large"
        );
        require(
            encryptedChunks.length == inputProofs.length,
            "Proof mismatch"
        );
        require(
            commitmentHash != bytes32(0),
            "Commitment required"
        );

        uint256 requestId = requestCount++;

        // Store encrypted document chunks
        // Grant Commission decryption rights to each chunk
        for (uint8 i = 0; i < encryptedChunks.length; i++) {
            euint256 chunk = FHE.fromExternal(
                encryptedChunks[i],
                inputProofs[i]
            );
            FHE.allowThis(chunk);
            // Commission can decrypt to verify identity
            FHE.allow(chunk, commission);
            // Citizen can also decrypt their own data
            FHE.allow(chunk, citizen);

            encryptedDocChunks[requestId].push(chunk);
        }

        // Store encrypted document type
        euint8 docType = FHE.fromExternal(
            encryptedDocTypeVal,
            docTypeProof
        );
        FHE.allowThis(docType);
        FHE.allow(docType, commission);
        FHE.allow(docType, citizen);
        encryptedDocType[requestId] = docType;

        // Store public metadata
        requests[requestId] = IdentityRequest({
            citizen:          citizen,
            submittedAt:      block.timestamp,
            requestId:        requestId,
            docChunkCount:    uint8(encryptedChunks.length),
            status:           RequestStatus.Pending,
            rejectionReason:  "",
            commitmentHash:   commitmentHash
        });

        citizenRequestId[citizen]  = requestId;
        hasPendingRequest[citizen] = true;
        allRequestIds.push(requestId);
        pendingRequestIds.push(requestId);

        emit IdentityRequestSubmitted(
            requestId,
            citizen,
            uint8(encryptedChunks.length),
            block.timestamp
        );
    }

    // ─────────────────────────────────────────────────
    // COMMISSION: APPROVE IDENTITY REQUEST
    // ─────────────────────────────────────────────────

    // Commission calls this after verifying identity
    // off-chain (they decrypt using FHE SDK userDecrypt)
    // Approval automatically registers voter

    function approveIdentityRequest(
        uint256 requestId
    ) external onlyCommission {
        IdentityRequest storage req = requests[requestId];

        require(
            req.citizen != address(0),
            "Request not found"
        );
        require(
            req.status == RequestStatus.Pending,
            "Not pending"
        );
        require(
            block.timestamp <=
            req.submittedAt + REQUEST_EXPIRY,
            "Request expired"
        );

        req.status = RequestStatus.Approved;
        hasPendingRequest[req.citizen] = false;
        isVerifiedCitizen[req.citizen] = true;

        // Remove from pending list
        _removeFromPending(requestId);

        // Generate voter ID hash from commitment
        bytes32 voterIdHash = keccak256(
            abi.encodePacked(
                req.citizen,
                req.commitmentHash,
                block.timestamp
            )
        );

        // Automatically register in VoterRegistry
        voterRegistry.registerVoter(
            req.citizen,
            voterIdHash
        );

        // Automatically mint the Voter Eligibility Pass NFT (Global passport, electionId = 0)
        if (address(voterPassContract) != address(0)) {
            euint256 identity = encryptedDocChunks[requestId][0];
            euint8 docType = encryptedDocType[requestId];
            
            FHE.allow(identity, address(voterPassContract));
            FHE.allow(docType, address(voterPassContract));
            
            voterPassContract.mintVoterPassDirect(
                req.citizen,
                0, // Global passport ID = 0
                identity,
                docType,
                req.commitmentHash,
                ""
            );
        }

        emit IdentityRequestApproved(
            requestId,
            req.citizen,
            msg.sender,
            block.timestamp
        );

        emit VoterAutoRegistered(
            requestId,
            req.citizen,
            block.timestamp
        );
    }

    // ─────────────────────────────────────────────────
    // COMMISSION: REJECT IDENTITY REQUEST
    // ─────────────────────────────────────────────────

    function rejectIdentityRequest(
        uint256 requestId,
        string calldata reason
    ) external onlyCommission {
        IdentityRequest storage req = requests[requestId];

        require(
            req.citizen != address(0),
            "Request not found"
        );
        require(
            req.status == RequestStatus.Pending,
            "Not pending"
        );
        require(
            bytes(reason).length >= 10,
            "Reason required (min 10 chars)"
        );

        req.status          = RequestStatus.Rejected;
        req.rejectionReason = reason;
        hasPendingRequest[req.citizen] = false;

        _removeFromPending(requestId);

        emit IdentityRequestRejected(
            requestId,
            req.citizen,
            msg.sender,
            reason,
            block.timestamp
        );
    }

    // ─────────────────────────────────────────────────
    // CITIZEN: RESUBMIT AFTER REJECTION
    // ─────────────────────────────────────────────────

    function resubmitIdentityRequest(
        externalEuint256[] calldata encryptedChunks,
        bytes[]            calldata inputProofs,
        externalEuint8             encryptedDocTypeVal,
        bytes              calldata docTypeProof,
        bytes32                    commitmentHash
    ) external {
        uint256 oldRequestId = citizenRequestId[msg.sender];

        require(
            requests[oldRequestId].status ==
            RequestStatus.Rejected,
            "Can only resubmit after rejection"
        );

        // Reset state for resubmission
        hasPendingRequest[msg.sender] = false;

        _submit(
            msg.sender,
            encryptedChunks,
            inputProofs,
            encryptedDocTypeVal,
            docTypeProof,
            commitmentHash
        );
    }

    // ─────────────────────────────────────────────────
    // READ FUNCTIONS
    // ─────────────────────────────────────────────────

    function getRequest(uint256 requestId)
        external view
        returns (IdentityRequest memory)
    {
        return requests[requestId];
    }

    function getCitizenStatus(address citizen)
        external view
        returns (
            bool isVerified,
            bool isPending,
            bool isRegistered,
            uint256 requestId,
            RequestStatus status,
            string memory rejectionReason
        )
    {
        uint256 reqId = citizenRequestId[citizen];
        IdentityRequest memory req = requests[reqId];

        return (
            isVerifiedCitizen[citizen],
            hasPendingRequest[citizen],
            voterRegistry.isRegisteredVoter(citizen),
            reqId,
            req.status,
            req.rejectionReason
        );
    }

    function getEncryptedDocType(uint256 requestId)
        external view
        returns (euint8)
    {
        return encryptedDocType[requestId];
    }

    function getEncryptedDocChunk(uint256 requestId, uint256 chunkIndex)
        external view
        returns (euint256)
    {
        require(
            chunkIndex < encryptedDocChunks[requestId].length,
            "Chunk index out of bounds"
        );
        return encryptedDocChunks[requestId][chunkIndex];
    }

    function getPendingRequests()
        external view
        returns (IdentityRequest[] memory)
    {
        IdentityRequest[] memory pending =
            new IdentityRequest[](pendingRequestIds.length);

        for (uint i = 0; i < pendingRequestIds.length; i++) {
            pending[i] = requests[pendingRequestIds[i]];
        }
        return pending;
    }

    function getAllRequests()
        external view
        returns (IdentityRequest[] memory)
    {
        IdentityRequest[] memory all =
            new IdentityRequest[](allRequestIds.length);

        for (uint i = 0; i < allRequestIds.length; i++) {
            all[i] = requests[allRequestIds[i]];
        }
        return all;
    }

    function getPendingCount()
        external view returns (uint256) {
        return pendingRequestIds.length;
    }

    function getEncryptedChunkCount(uint256 requestId)
        external view returns (uint256) {
        return encryptedDocChunks[requestId].length;
    }

    // Change commission address (emergency only)
    function setCommission(address newCommission)
        external onlyOwner {
        emit CommissionChanged(commission, newCommission);
        commission = newCommission;
        if (!isCommissioner[newCommission]) {
            isCommissioner[newCommission] = true;
            commissioners.push(newCommission);
        }
    }

    event CommissionerAppointed(address indexed appointedBy, address indexed newCommissioner);

    // Appoint a new commissioner
    function appointCommissioner(address newCommissioner)
        external onlyCommission {
        require(newCommissioner != address(0), "Invalid address");
        require(!isCommissioner[newCommissioner], "Already commissioner");
        isCommissioner[newCommissioner] = true;
        commissioners.push(newCommissioner);
        emit CommissionerAppointed(msg.sender, newCommissioner);
    }

    // Delegate FHE decryption access for a request to a new commissioner
    function delegateRequestAccess(uint256 requestId, address targetCommissioner)
        external onlyCommission {
        require(isCommissioner[targetCommissioner], "Target must be commissioner");
        
        euint256[] storage chunks = encryptedDocChunks[requestId];
        require(chunks.length > 0, "Request not found");

        for (uint8 i = 0; i < chunks.length; i++) {
            FHE.allow(chunks[i], targetCommissioner);
        }
        FHE.allow(encryptedDocType[requestId], targetCommissioner);
    }

    // Get the list of all active commissioners
    function getCommissioners()
        external view returns (address[] memory) {
        return commissioners;
    }

    // ─────────────────────────────────────────────────
    // INTERNAL
    // ─────────────────────────────────────────────────

    function _removeFromPending(
        uint256 requestId
    ) internal {
        for (uint i = 0; i < pendingRequestIds.length; i++) {
            if (pendingRequestIds[i] == requestId) {
                pendingRequestIds[i] =
                    pendingRequestIds[
                        pendingRequestIds.length - 1
                    ];
                pendingRequestIds.pop();
                break;
            }
        }
    }
}
