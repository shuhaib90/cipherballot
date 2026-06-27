// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {externalEuint8} from "@fhevm/solidity/lib/FHE.sol";

interface IVoterRegistry {
    function registerVoter(address voter, bytes32 voterIdHash) external;
    function registerVotersBatch(address[] calldata voters, bytes32[] calldata hashes) external;
    function revokeVoter(address voter) external;
    function isRegisteredVoter(address voter) external view returns (bool);
    function getVoterCount() external view returns (uint256);
    function getVoterIdHash(address voter) external view returns (bytes32);
}

interface IElectionFactory {
    function createElection(
        string calldata name,
        string calldata description,
        string[] calldata candidateNames,
        string[] calldata candidateParties,
        string[] calldata candidateSymbols,
        uint256 startTime,
        uint256 endTime
    ) external returns (address);
    function getElectionCount() external view returns (uint256);
    function getElection(uint256 index) external view returns (address);
    function getAllElections() external view returns (address[] memory);
}

interface IElection {
    struct Candidate {
        string name;
        string party;
        string symbol;
    }

    struct ElectionInfo {
        uint256 electionId;
        string name;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 totalVotesCast;
        uint8 candidateCount;
        bool resultsRevealed;
        address commissionAddress;
    }

    function castVote(externalEuint8 encryptedChoice, bytes calldata inputProof) external;
    function revealResults() external;
    function getElectionInfo() external view returns (ElectionInfo memory);
    function hasVoted(address voter) external view returns (bool);
    function getTotalVotesCast() external view returns (uint256);
    function getResults() external view returns (uint32[] memory);
}
