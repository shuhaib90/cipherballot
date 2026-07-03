// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {FHE, euint8, euint32, ebool, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./VoterRegistry.sol";

interface IVoterPass {
    function verifyVoterPass(
        address voter,
        uint256 electionId
    ) external view returns (bool);
    
    function markPassAsUsed(
        address voter,
        uint256 electionId
    ) external returns (bool);
}

contract Election is ZamaEthereumConfig {
    // ─── Structs ─────────────────────────────────────
    struct Candidate {
        string name;
        string party;
        string symbol;    // emoji symbol e.g. "🌹"
    }

    struct ElectionInfo {
        uint256 electionId;
        string  name;
        string  description;
        uint256 startTime;
        uint256 endTime;
        uint256 totalVotesCast;
        uint8   candidateCount;
        bool    resultsRevealed;
        address commissionAddress;
    }

    // ─── State ───────────────────────────────────────
    VoterRegistry public immutable voterRegistry;
    IVoterPass public immutable voterPassContract;
    address public immutable commission;
    uint256 public immutable electionId;

    string public electionName;
    string public electionDescription;
    uint256 public startTime;
    uint256 public endTime;

    Candidate[] public candidates;
    uint8 public candidateCount;

    // Encrypted tallies — one per candidate
    // Nobody can read these during the election
    euint32[] private encryptedTallies;

    // Vote tracking
    mapping(address => bool) public hasVoted;
    uint256 public totalVotesCast;

    // Results (only populated after reveal)
    uint32[] public results;
    bool public resultsRevealed;

    // ─── Events ──────────────────────────────────────
    event VoteCast(
        address indexed voter,
        uint256 indexed electionId,
        uint256 timestamp
    );
    event ResultsRevealRequested(
        uint256 indexed electionId,
        uint256 timestamp
    );
    event ResultsRevealed(
        uint256 indexed electionId,
        uint32[] results,
        uint256 timestamp
    );
    event ElectionCreated(
        uint256 indexed electionId,
        string name,
        uint256 startTime,
        uint256 endTime,
        uint8 candidateCount
    );

    // ─── Modifiers ───────────────────────────────────
    modifier onlyCommission() {
        require(
            msg.sender == commission,
            "Only Election Commission"
        );
        _;
    }

    modifier electionOpen() {
        require(
            block.timestamp >= startTime,
            "Election not started"
        );
        require(
            block.timestamp < endTime,
            "Election closed"
        );
        _;
    }

    modifier electionClosed() {
        require(
            block.timestamp >= endTime,
            "Election still open"
        );
        _;
    }

    // ─── Constructor ─────────────────────────────────
    constructor(
        uint256 _electionId,
        string memory _name,
        string memory _description,
        string[] memory _candidateNames,
        string[] memory _candidateParties,
        string[] memory _candidateSymbols,
        uint256 _startTime,
        uint256 _endTime,
        address _voterRegistry,
        address _commission,
        address _voterPassContract
    ) {
        require(
            _candidateNames.length >= 2,
            "Min 2 candidates"
        );
        require(
            _candidateNames.length <= 10,
            "Max 10 candidates"
        );
        require(
            _candidateNames.length == _candidateParties.length,
            "Name/party mismatch"
        );
        require(
            _startTime < _endTime,
            "Invalid time range"
        );
        require(
            _endTime > block.timestamp,
            "End time in past"
        );
        require(
            _voterPassContract != address(0),
            "Invalid pass contract address"
        );

        electionId      = _electionId;
        electionName    = _name;
        electionDescription = _description;
        startTime       = _startTime;
        endTime         = _endTime;
        voterRegistry   = VoterRegistry(_voterRegistry);
        voterPassContract = IVoterPass(_voterPassContract);
        commission      = _commission;
        candidateCount  = uint8(_candidateNames.length);

        // Initialize candidates and encrypted tallies
        for (uint8 i = 0; i < _candidateNames.length; i++) {
            candidates.push(Candidate({
                name:   _candidateNames[i],
                party:  _candidateParties[i],
                symbol: i < _candidateSymbols.length
                    ? _candidateSymbols[i] : unicode"🗳️"
            }));

            // Initialize each tally to encrypted zero
            euint32 zeroTally = FHE.asEuint32(0);
            FHE.allowThis(zeroTally);
            encryptedTallies.push(zeroTally);
        }

        emit ElectionCreated(
            _electionId,
            _name,
            _startTime,
            _endTime,
            uint8(_candidateNames.length)
        );
    }

    // ─── CAST VOTE ───────────────────────────────────
    // This is the core FHE function
    // encryptedChoice is the candidate index (0, 1, 2...)
    // encrypted client-side — contract never sees it

    function castVote(
        externalEuint8 encryptedChoice,
        bytes calldata inputProof
    ) external electionOpen {

        // Check 1: Must own valid FHE Voter Eligibility Pass NFT
        require(
            voterPassContract.verifyVoterPass(msg.sender, electionId),
            "Invalid or missing Voter Pass NFT"
        );

        // Check 2: Cannot vote twice
        // This is mathematically enforced — no exceptions
        require(
            !hasVoted[msg.sender],
            "Already voted in this election"
        );

        // Mark as voted BEFORE processing
        // (prevents reentrancy)
        hasVoted[msg.sender] = true;
        totalVotesCast++;

        // Convert external encrypted input to internal type
        euint8 choice = FHE.fromExternal(
            encryptedChoice,
            inputProof
        );

        // THE CORE FHE OPERATION:
        // For each candidate, check if this vote is for them
        // Add 1 to their tally if yes, 0 if no
        // Contract NEVER knows which candidate was chosen
        for (uint8 i = 0; i < candidateCount; i++) {

            // Is this candidate the chosen one?
            // FHE comparison — result is encrypted boolean
            ebool isChosen = FHE.eq(
                choice,
                FHE.asEuint8(i)
            );

            // Add encrypted 1 or 0 to this candidate's tally
            // FHE.select = encrypted ternary operator
            euint32 increment = FHE.select(
                isChosen,
                FHE.asEuint32(1),
                FHE.asEuint32(0)
            );

            // Update the tally — still encrypted
            encryptedTallies[i] = FHE.add(
                encryptedTallies[i],
                increment
            );

            // Allow this contract to use the updated tally
            FHE.allowThis(encryptedTallies[i]);
        }

        // Mark pass as used
        voterPassContract.markPassAsUsed(msg.sender, electionId);

        emit VoteCast(msg.sender, electionId, block.timestamp);
    }

    // ─── REVEAL RESULTS ──────────────────────────────
    // Step 1: Mark tallies as decryptable. Call off-chain decryption afterward.
    function requestRevealResults() external electionClosed {
        require(!resultsRevealed, "Already revealed");

        for (uint8 i = 0; i < candidateCount; i++) {
            FHE.makePubliclyDecryptable(encryptedTallies[i]);
        }

        emit ResultsRevealRequested(electionId, block.timestamp);
    }

    // Step 2: Submit decryption proof from KMS Relayer to finalize
    function finalizeRevealResults(
        uint32[] calldata decryptedTallies,
        bytes calldata publicDecryptionProof
    ) external electionClosed {
        require(!resultsRevealed, "Already revealed");
        require(decryptedTallies.length == candidateCount, "Tally count mismatch");

        bytes32[] memory handles = new bytes32[](candidateCount);
        for (uint8 i = 0; i < candidateCount; i++) {
            handles[i] = FHE.toBytes32(encryptedTallies[i]);
        }

        bytes memory abiEncodedCleartexts;
        if (candidateCount == 2) {
            abiEncodedCleartexts = abi.encode(decryptedTallies[0], decryptedTallies[1]);
        } else if (candidateCount == 3) {
            abiEncodedCleartexts = abi.encode(decryptedTallies[0], decryptedTallies[1], decryptedTallies[2]);
        } else if (candidateCount == 4) {
            abiEncodedCleartexts = abi.encode(decryptedTallies[0], decryptedTallies[1], decryptedTallies[2], decryptedTallies[3]);
        } else if (candidateCount == 5) {
            abiEncodedCleartexts = abi.encode(decryptedTallies[0], decryptedTallies[1], decryptedTallies[2], decryptedTallies[3], decryptedTallies[4]);
        } else if (candidateCount == 6) {
            abiEncodedCleartexts = abi.encode(decryptedTallies[0], decryptedTallies[1], decryptedTallies[2], decryptedTallies[3], decryptedTallies[4], decryptedTallies[5]);
        } else if (candidateCount == 7) {
            abiEncodedCleartexts = abi.encode(decryptedTallies[0], decryptedTallies[1], decryptedTallies[2], decryptedTallies[3], decryptedTallies[4], decryptedTallies[5], decryptedTallies[6]);
        } else if (candidateCount == 8) {
            abiEncodedCleartexts = abi.encode(decryptedTallies[0], decryptedTallies[1], decryptedTallies[2], decryptedTallies[3], decryptedTallies[4], decryptedTallies[5], decryptedTallies[6], decryptedTallies[7]);
        } else if (candidateCount == 9) {
            abiEncodedCleartexts = abi.encode(decryptedTallies[0], decryptedTallies[1], decryptedTallies[2], decryptedTallies[3], decryptedTallies[4], decryptedTallies[5], decryptedTallies[6], decryptedTallies[7], decryptedTallies[8]);
        } else if (candidateCount == 10) {
            abiEncodedCleartexts = abi.encode(decryptedTallies[0], decryptedTallies[1], decryptedTallies[2], decryptedTallies[3], decryptedTallies[4], decryptedTallies[5], decryptedTallies[6], decryptedTallies[7], decryptedTallies[8], decryptedTallies[9]);
        } else {
            revert("Invalid candidate count");
        }

        FHE.checkSignatures(handles, abiEncodedCleartexts, publicDecryptionProof);

        results = decryptedTallies;
        resultsRevealed = true;

        emit ResultsRevealed(
            electionId,
            decryptedTallies,
            block.timestamp
        );
    }

    // ─── READ FUNCTIONS ──────────────────────────────

    function getElectionInfo()
        external view
        returns (ElectionInfo memory)
    {
        return ElectionInfo({
            electionId:       electionId,
            name:             electionName,
            description:      electionDescription,
            startTime:        startTime,
            endTime:          endTime,
            totalVotesCast:   totalVotesCast,
            candidateCount:   candidateCount,
            resultsRevealed:  resultsRevealed,
            commissionAddress: commission
        });
    }

    function getCandidate(uint8 index)
        external view
        returns (
            string memory name,
            string memory party,
            string memory symbol
        )
    {
        require(index < candidateCount, "Invalid index");
        Candidate memory c = candidates[index];
        return (c.name, c.party, c.symbol);
    }

    function getAllCandidates()
        external view
        returns (Candidate[] memory)
    {
        return candidates;
    }

    function getResults()
        external view
        returns (uint32[] memory)
    {
        require(resultsRevealed, "Results not yet revealed");
        return results;
    }

    function getEncryptedTallyHandles()
        external view
        returns (bytes32[] memory)
    {
        bytes32[] memory handles = new bytes32[](candidateCount);
        for (uint8 i = 0; i < candidateCount; i++) {
            handles[i] = FHE.toBytes32(encryptedTallies[i]);
        }
        return handles;
    }

    function getWinner()
        external view
        returns (
            uint8 winnerIndex,
            string memory winnerName,
            string memory winnerParty,
            uint32 winnerVotes
        )
    {
        require(resultsRevealed, "Results not revealed");

        uint8 winner = 0;
        uint32 maxVotes = 0;

        for (uint8 i = 0; i < candidateCount; i++) {
            if (results[i] > maxVotes) {
                maxVotes = results[i];
                winner = i;
            }
        }

        return (
            winner,
            candidates[winner].name,
            candidates[winner].party,
            maxVotes
        );
    }

    function getElectionStatus()
        external view
        returns (string memory status)
    {
        if (block.timestamp < startTime) return "upcoming";
        if (block.timestamp < endTime) return "active";
        if (!resultsRevealed) return "counting";
        return "completed";
    }

    function getTotalVotesCast()
        external view returns (uint256) {
        return totalVotesCast;
    }
}
