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
        if (tokenId == 0) {
            // Fallback: Check if the voter has a global pass (electionId = 0)
            tokenId = walletTokens[voter][0];
            if (tokenId == 0) return false;
        }
        if (ownerOf(tokenId) != voter) return false;
        if (passMetadata[tokenId].originalMinter != voter) return false;
        if (!passMetadata[tokenId].isActive) return false;
        
        uint256 tokenElecId = passMetadata[tokenId].electionId;
        if (tokenElecId != electionId && tokenElecId != 0) return false;
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
        if (tokenId == 0) {
            // Fallback: Check if the voter has a global pass (electionId = 0)
            tokenId = walletTokens[voter][0];
            require(tokenId != 0, "No pass found");
            // Global passes can be reused in different elections, so we don't enforce hasBeenUsedToVote = false
        } else {
            require(!passMetadata[tokenId].hasBeenUsedToVote, "Already used to vote");
            passMetadata[tokenId].hasBeenUsedToVote = true;
        }
        
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
                '<linearGradient id="silverGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" stop-color="#ffffff" />',
                '<stop offset="50%" stop-color="#e0e0e0" />',
                '<stop offset="100%" stop-color="#b0b0b0" />',
                '</linearGradient>',
                '<linearGradient id="darkGrad" x1="0%" y1="0%" x2="100%" y2="100%">',
                '<stop offset="0%" stop-color="#151518" />',
                '<stop offset="100%" stop-color="#0a0a0c" />',
                '</linearGradient>',
                '</defs>',
                // Outer Card
                '<rect x="0" y="0" width="500" height="320" rx="24" fill="url(#darkGrad)" stroke="#333336" stroke-width="2" />',
                // Top Silver Plate
                '<path d="M 0 24 Q 0 0 24 0 L 476 0 Q 500 0 500 24 L 500 140 L 420 140 L 390 160 L 110 160 L 80 140 L 0 140 Z" fill="url(#silverGrad)" />',
                // QR Code Container (Mock QR Code)
                '<rect x="35" y="30" width="80" height="80" rx="8" fill="#111111" />',
                '<rect x="43" y="38" width="20" height="20" fill="#ffffff" />',
                '<rect x="47" y="42" width="12" height="12" fill="#111111" />',
                '<rect x="87" y="38" width="20" height="20" fill="#ffffff" />',
                '<rect x="91" y="42" width="12" height="12" fill="#111111" />',
                '<rect x="43" y="82" width="20" height="20" fill="#ffffff" />',
                '<rect x="47" y="86" width="12" height="12" fill="#111111" />',
                '<rect x="75" y="60" width="10" height="10" fill="#ffffff" />',
                '<rect x="87" y="72" width="15" height="15" fill="#ffffff" />',
                '<rect x="70" y="85" width="12" height="12" fill="#ffffff" />',
                // Center Badge (Leaf Coin)
                '<circle cx="250" cy="80" r="30" fill="#111111" stroke="#444444" stroke-width="2" />',
                '<path d="M 245 95 C 240 85 245 70 255 65 C 260 75 255 90 245 95 Z" fill="none" stroke="#ffffff" stroke-width="1.5" />',
                '<path d="M 245 95 L 252 72" fill="none" stroke="#ffffff" stroke-width="1" />',
                // Rare Stamp
                '<circle cx="410" cy="80" r="28" fill="none" stroke="#777777" stroke-width="1.5" stroke-dasharray="4 2" />',
                '<text x="410" y="83" fill="#555555" font-family="system-ui" font-size="8" font-weight="bold" text-anchor="middle" letter-spacing="1">RARE</text>',
                // VEPASS Label
                '<rect x="35" y="180" width="85" height="24" rx="12" fill="#222225" stroke="#444448" stroke-width="1" />',
                '<text x="77.5" y="196" fill="#ffffff" font-family="system-ui" font-size="10" font-weight="bold" text-anchor="middle" letter-spacing="1">VEPASS</text>',
                // PNF text
                '<text x="35" y="235" fill="#ffffff" font-family="system-ui" font-size="28" font-weight="900" letter-spacing="1">PNF</text>',
                '<text x="35" y="250" fill="#88888b" font-family="system-ui" font-size="8" font-weight="bold" letter-spacing="1.5">PRIVATE NFT PASS</text>',
                // Barcode Container
                '<rect x="35" y="265" width="90" height="35" rx="6" fill="#dcdcdc" />',
                // Barcode Lines
                '<line x1="45" y1="270" x2="45" y2="282" stroke="#111111" stroke-width="2" />',
                '<line x1="50" y1="270" x2="50" y2="282" stroke="#111111" stroke-width="1" />',
                '<line x1="55" y1="270" x2="55" y2="282" stroke="#111111" stroke-width="3" />',
                '<line x1="62" y1="270" x2="62" y2="282" stroke="#111111" stroke-width="1" />',
                '<line x1="68" y1="270" x2="68" y2="282" stroke="#111111" stroke-width="2" />',
                '<line x1="74" y1="270" x2="74" y2="282" stroke="#111111" stroke-width="4" />',
                '<line x1="82" y1="270" x2="82" y2="282" stroke="#111111" stroke-width="1" />',
                '<line x1="88" y1="270" x2="88" y2="282" stroke="#111111" stroke-width="2" />',
                '<line x1="95" y1="270" x2="95" y2="282" stroke="#111111" stroke-width="3" />',
                '<line x1="102" y1="270" x2="102" y2="282" stroke="#111111" stroke-width="1" />',
                '<line x1="108" y1="270" x2="108" y2="282" stroke="#111111" stroke-width="2" />',
                '<line x1="115" y1="270" x2="115" y2="282" stroke="#111111" stroke-width="2" />',
                // Barcode Number text
                '<text x="80" y="295" fill="#111111" font-family="monospace" font-size="10" font-weight="bold" text-anchor="middle" letter-spacing="2">0 0 ',
                Strings.toString(tokenId),
                '</text>',
                // Right Badge
                '<text x="465" y="195" fill="#88888b" font-family="system-ui" font-size="8" font-weight="bold" text-anchor="end" letter-spacing="1">VERIFIED BY FHEVM</text>',
                '<text x="465" y="210" fill="#88888b" font-family="system-ui" font-size="8" font-weight="bold" text-anchor="end" letter-spacing="1">ZERO-TRUST ENCRYPTION</text>',
                '<text x="465" y="225" fill="#88888b" font-family="system-ui" font-size="8" font-weight="bold" text-anchor="end" letter-spacing="1">BOUND TO WALLET</text>',
                // CipherBallot Branding
                '<circle cx="340" cy="275" r="8" fill="none" stroke="#ffffff" stroke-width="1.5" />',
                '<path d="M 337 275 L 343 275 M 340 272 L 340 278" stroke="#ffffff" stroke-width="1" />',
                '<text x="355" y="278" fill="#ffffff" font-family="system-ui" font-size="12" font-weight="bold" letter-spacing="0.5">CipherBallot</text>',
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
