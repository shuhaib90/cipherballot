// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint256, euint8, externalEuint256, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

interface IElectionFactory {
    function isDeployedElection(address addr) external view returns (bool);
}

contract VoterEligibilityPass is 
    ERC721, 
    Ownable, 
    ZamaEthereumConfig 
{
    // ═══════════════════════════════════════════════════════
    // STRUCTURES
    // ═══════════════════════════════════════════════════════
    
    struct VoterPassMetadata {
        euint256 encryptedVoterIdentity;
        euint8 encryptedDocumentType;
        bytes32 commitmentHash;
        uint256 electionId;
        uint256 mintedAt;
        address originalMinter;
        bytes commissionSignature;
        bool isActive;
        bool hasBeenUsedToVote;
    }
    
    // ═══════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════
    
    // Token ID → Metadata
    mapping(uint256 => VoterPassMetadata) public passMetadata;
    
    // Wallet Address → Election ID → Token ID
    mapping(address => mapping(uint256 => uint256)) public walletTokens;
    
    uint256 public totalPassesMinted;
    uint256 private tokenIdCounter = 1;
    
    address public commissionAddress;
    address public electionFactoryAddress;
    
    mapping(address => bool) public isAuthorizedMinter;
    
    // Authorized signers — any commissioner can sign approvals
    mapping(address => bool) public isAuthorizedSigner;
    
    // ═══════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════
    
    event VoterPassMinted(
        uint256 indexed tokenId,
        address indexed voter,
        uint256 electionId,
        bytes32 commitmentHash
    );
    
    event VoterPassUsedToVote(
        uint256 indexed tokenId,
        address indexed voter,
        uint256 electionId
    );
    
    event VoterPassRevoked(
        uint256 indexed tokenId,
        address indexed voter,
        string reason
    );
    
    // ═══════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════
    
    modifier onlyCommission() {
        require(msg.sender == commissionAddress, "Only Commission");
        _;
    }

    modifier onlyAuthorizedMinter() {
        require(
            msg.sender == commissionAddress || 
            msg.sender == owner() ||
            isAuthorizedMinter[msg.sender],
            "Not authorized to mint direct"
        );
        _;
    }
    
    // ═══════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════
    
    constructor(address _commission) 
        ERC721("VoterPass", "VEPASS") 
        Ownable(msg.sender) 
    {
        require(_commission != address(0), "Invalid commission address");
        commissionAddress = _commission;
    }

    function setElectionFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Invalid factory address");
        electionFactoryAddress = _factory;
    }

    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        isAuthorizedMinter[minter] = authorized;
    }

    function setAuthorizedSigner(address signer_, bool authorized) external onlyOwner {
        require(signer_ != address(0), "Invalid signer address");
        isAuthorizedSigner[signer_] = authorized;
    }
    
    // ═══════════════════════════════════════════════════════
    // MINTING FUNCTIONS
    // ═══════════════════════════════════════════════════════
    
    /**
     * Citizen-triggered Minting (Signature Verified)
     * Anyone can call this if they present a valid signature from the Commission
     */
    function mintVoterPass(
        address voter,
        uint256 electionId,
        externalEuint256 encryptedIdentity,
        bytes calldata identityProof,
        externalEuint8 encryptedDocType,
        bytes calldata docTypeProof,
        bytes32 commitmentHash,
        bytes calldata commissionSignature
    ) external returns (uint256) {
        require(voter == msg.sender, "Can only mint for yourself");
        require(walletTokens[voter][electionId] == 0, "Already minted for this election");

        // Verify the Commission's signature authorizing this mint
        require(
            _verifySignature(voter, electionId, commitmentHash, commissionSignature),
            "Invalid commission signature"
        );
        
        uint256 tokenId = tokenIdCounter++;
        
        euint256 identity = FHE.fromExternal(encryptedIdentity, identityProof);
        euint8 docType = FHE.fromExternal(encryptedDocType, docTypeProof);
        
        FHE.allowThis(identity);
        FHE.allow(identity, commissionAddress);
        FHE.allow(identity, voter);
        
        FHE.allowThis(docType);
        FHE.allow(docType, commissionAddress);
        FHE.allow(docType, voter);
        
        passMetadata[tokenId] = VoterPassMetadata({
            encryptedVoterIdentity: identity,
            encryptedDocumentType: docType,
            commitmentHash: commitmentHash,
            electionId: electionId,
            mintedAt: block.timestamp,
            originalMinter: voter,
            commissionSignature: commissionSignature,
            isActive: true,
            hasBeenUsedToVote: false
        });
        
        walletTokens[voter][electionId] = tokenId;
        _mint(voter, tokenId);
        totalPassesMinted++;
        
        emit VoterPassMinted(tokenId, voter, electionId, commitmentHash);
        
        return tokenId;
    }

    /**
     * privileged Direct Minting
     * Called automatically during FHEIdentityRegistry approval flow
     */
    function mintVoterPassDirect(
        address voter,
        uint256 electionId,
        euint256 identity,
        euint8 docType,
        bytes32 commitmentHash,
        bytes calldata commissionSignature
    ) external onlyAuthorizedMinter returns (uint256) {
        require(walletTokens[voter][electionId] == 0, "Already minted for this election");

        uint256 tokenId = tokenIdCounter++;

        FHE.allowThis(identity);
        FHE.allow(identity, commissionAddress);
        FHE.allow(identity, voter);
        
        FHE.allowThis(docType);
        FHE.allow(docType, commissionAddress);
        FHE.allow(docType, voter);
        
        passMetadata[tokenId] = VoterPassMetadata({
            encryptedVoterIdentity: identity,
            encryptedDocumentType: docType,
            commitmentHash: commitmentHash,
            electionId: electionId,
            mintedAt: block.timestamp,
            originalMinter: voter,
            commissionSignature: commissionSignature,
            isActive: true,
            hasBeenUsedToVote: false
        });
        
        walletTokens[voter][electionId] = tokenId;
        _mint(voter, tokenId);
        totalPassesMinted++;
        
        emit VoterPassMinted(tokenId, voter, electionId, commitmentHash);
        
        return tokenId;
    }
    
    // ═══════════════════════════════════════════════════════
    // VOTING VERIFICATION & CONTROLS
    // ═══════════════════════════════════════════════════════
    
    function verifyVoterPass(
        address voter,
        uint256 electionId
    ) external view returns (bool) {
        uint256 tokenId = walletTokens[voter][electionId];
        if (tokenId == 0) return false;
        if (ownerOf(tokenId) != voter) return false;
        if (passMetadata[tokenId].originalMinter != voter) return false;
        if (!passMetadata[tokenId].isActive) return false;
        if (passMetadata[tokenId].electionId != electionId) return false;
        return true;
    }
    
    function markPassAsUsed(
        address voter,
        uint256 electionId
    ) external returns (bool) {
        // Protect function: only authorize deployed elections
        if (electionFactoryAddress != address(0)) {
            require(
                IElectionFactory(electionFactoryAddress).isDeployedElection(msg.sender),
                "Only deployed election contracts allowed"
            );
        }
        
        uint256 tokenId = walletTokens[voter][electionId];
        require(tokenId != 0, "No pass found");
        require(!passMetadata[tokenId].hasBeenUsedToVote, "Already used to vote");
        
        passMetadata[tokenId].hasBeenUsedToVote = true;
        
        emit VoterPassUsedToVote(tokenId, voter, electionId);
        
        return true;
    }
    
    // ═══════════════════════════════════════════════════════
    // SOULBOUND RESTRICTIONS
    // ═══════════════════════════════════════════════════════
    
    function _update(
        address to, 
        uint256 tokenId, 
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Only allow minting (from == address(0)) or burning (to == address(0))
        if (from != address(0) && to != address(0)) {
            revert("VEPass is soulbound - transfer blocked");
        }
        return super._update(to, tokenId, auth);
    }
    
    // ═══════════════════════════════════════════════════════
    // REVOCATION
    // ═══════════════════════════════════════════════════════
    
    function revokePass(
        uint256 tokenId,
        string calldata reason
    ) external onlyCommission {
        require(passMetadata[tokenId].isActive, "Already revoked");
        passMetadata[tokenId].isActive = false;
        emit VoterPassRevoked(tokenId, ownerOf(tokenId), reason);
    }
    
    // ═══════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════
    
    function _verifySignature(
        address voter,
        uint256 electionId,
        bytes32 commitmentHash,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(voter, electionId, commitmentHash)
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        address recoveredSigner = _recoverSigner(ethSignedMessageHash, signature);
        // Accept signature from commissionAddress OR any authorized signer
        if (recoveredSigner == commissionAddress || isAuthorizedSigner[recoveredSigner]) {
            return true;
        }

        // Fallback: Check if the signature was signed for global election ID = 0
        bytes32 globalHash = keccak256(
            abi.encodePacked(voter, uint256(0), commitmentHash)
        );
        bytes32 ethSignedGlobalHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", globalHash)
        );
        recoveredSigner = _recoverSigner(ethSignedGlobalHash, signature);
        return (recoveredSigner == commissionAddress || isAuthorizedSigner[recoveredSigner]);
    }

    function _recoverSigner(
        bytes32 ethSignedMessageHash,
        bytes memory signature
    ) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        return ecrecover(ethSignedMessageHash, v, r, s);
    }
    
    // ═══════════════════════════════════════════════════════
    // VIEW & METADATA
    // ═══════════════════════════════════════════════════════
    
    function getPassMetadata(uint256 tokenId)
        external
        view
        returns (VoterPassMetadata memory)
    {
        return passMetadata[tokenId];
    }
    
    function getPassByWalletAndElection(
        address voter,
        uint256 electionId
    ) external view returns (uint256) {
        return walletTokens[voter][electionId];
    }
    
    function _buildSvg(uint256 tokenId, uint256 electionId) internal pure returns (string memory) {
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 320" width="100%" height="100%">',
                '<defs>',
                '<linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" stop-color="#0f0926" />',
                '<stop offset="100%" stop-color="#241147" />',
                '</linearGradient>',
                '<linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" stop-color="#FFE57F" />',
                '<stop offset="100%" stop-color="#FFC107" />',
                '</linearGradient>',
                '</defs>',
                '<rect x="0" y="0" width="500" height="320" rx="20" fill="url(#bgGrad)" stroke="url(#goldGrad)" stroke-width="2" />',
                '<circle cx="450" cy="50" r="100" fill="none" stroke="rgba(224, 64, 251, 0.15)" stroke-width="1.5" />',
                '<circle cx="450" cy="50" r="70" fill="none" stroke="rgba(255, 193, 7, 0.1)" stroke-width="1.5" />',
                '<text x="35" y="55" fill="#FFE57F" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="800" letter-spacing="1">CIPHERBALLOT</text>',
                '<text x="35" y="75" fill="rgba(255, 255, 255, 0.5)" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="600" letter-spacing="1.5">FHE SOULBOUND VEPass</text>',
                '<rect x="35" y="110" width="45" height="35" rx="6" fill="#ffe57f" opacity="0.85" />',
                '<path d="M 35 127.5 L 80 127.5 M 57.5 110 L 57.5 145" stroke="#0f0926" stroke-width="1" />',
                '<rect x="380" y="35" width="85" height="24" rx="12" fill="rgba(0, 230, 118, 0.15)" stroke="#00E676" stroke-width="1" />',
                '<text x="422.5" y="49" fill="#00E676" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="bold" text-anchor="middle">@ VERIFIED</text>',
                '<text x="35" y="195" fill="rgba(255, 255, 255, 0.5)" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="700" letter-spacing="0.5">STATUS</text>',
                '<text x="35" y="212" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800">ACTIVE PASS</text>',
                '<text x="180" y="195" fill="rgba(255, 255, 255, 0.5)" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="700" letter-spacing="0.5">ELECTION ID</text>',
                '<text x="180" y="212" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800">',
                Strings.toString(electionId),
                '</text>',
                '<text x="300" y="195" fill="rgba(255, 255, 255, 0.5)" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="700" letter-spacing="0.5">PASS ID</text>',
                '<text x="300" y="212" fill="#FFE57F" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800">#',
                Strings.toString(tokenId),
                '</text>',
                '<line x1="35" y1="250" x2="465" y2="250" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />',
                '<text x="35" y="280" fill="rgba(255, 255, 255, 0.4)" font-family="system-ui, -apple-system, sans-serif" font-size="8" font-weight="600">BOUND TO REGISTERED WALLET</text>',
                '<text x="465" y="280" fill="#E040FB" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="bold" text-anchor="end" letter-spacing="1">ZAMA FHEVM</text>',
                '</svg>'
            )
        );
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        _requireOwned(tokenId);
        VoterPassMetadata memory meta = passMetadata[tokenId];
        
        string memory svg = _buildSvg(tokenId, meta.electionId);
        string memory imageUri = string(
            abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg)))
        );

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"Voter Eligibility Pass #',
                        Strings.toString(tokenId),
                        '","description":"Soulbound voter eligibility pass. ',
                        'Proves voter registration for election ID ',
                        Strings.toString(meta.electionId),
                        '. Non-transferable and bound to voter wallet.",',
                        '"image":"',
                        imageUri,
                        '",',
                        '"attributes":[',
                        '{"trait_type":"Election ID","value":"',
                        Strings.toString(meta.electionId),
                        '"},',
                        '{"trait_type":"Minted At","value":"',
                        Strings.toString(meta.mintedAt),
                        '"},',
                        '{"trait_type":"Status","value":"',
                        (meta.isActive ? "Active" : "Revoked"),
                        '"},',
                        '{"trait_type":"Soulbound","value":"true"}',
                        ']}'
                    )
                )
            )
        );
        
        return string(abi.encodePacked("data:application/json;base64,", json));
    }
}
