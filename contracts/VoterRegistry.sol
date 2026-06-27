// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract VoterRegistry is Ownable {

    // State
    mapping(address => bool) public isRegisteredVoter;
    mapping(address => bytes32) public voterIdHash;
    mapping(address => uint256) public registeredAt;
    address[] public voterList;
    uint256 public voterCount;
    mapping(address => bool) public isRegistrar;

    // Events
    event VoterRegistered(
        address indexed voter,
        bytes32 voterIdHash,
        uint256 timestamp
    );
    event VoterRevoked(
        address indexed voter,
        uint256 timestamp
    );
    event BatchRegistered(
        uint256 count,
        uint256 timestamp
    );
    event RegistrarAdded(address indexed registrar);
    event RegistrarRemoved(address indexed registrar);

    modifier onlyOwnerOrRegistrar() {
        require(
            msg.sender == owner() ||
            isRegistrar[msg.sender],
            "Not authorized"
        );
        _;
    }

    constructor() Ownable(msg.sender) {}

    // Register single voter
    // voterIdHash = keccak256(nationalID + salt)
    // stored on-chain as proof of eligibility
    // without revealing actual national ID
    function registerVoter(
        address voter,
        bytes32 _voterIdHash
    ) external onlyOwnerOrRegistrar {
        require(voter != address(0), "Zero address");
        require(!isRegisteredVoter[voter], "Already registered");
        require(_voterIdHash != bytes32(0), "Invalid hash");

        isRegisteredVoter[voter] = true;
        voterIdHash[voter] = _voterIdHash;
        registeredAt[voter] = block.timestamp;
        voterList.push(voter);
        voterCount++;

        emit VoterRegistered(voter, _voterIdHash, block.timestamp);
    }

    // Batch register for efficiency
    // Election Commission registers thousands at once
    function registerVotersBatch(
        address[] calldata voters,
        bytes32[] calldata hashes
    ) external onlyOwnerOrRegistrar {
        require(
            voters.length == hashes.length,
            "Length mismatch"
        );
        require(voters.length <= 500, "Max 500 per batch");

        for (uint256 i = 0; i < voters.length; i++) {
            if (
                voters[i] != address(0) &&
                !isRegisteredVoter[voters[i]] &&
                hashes[i] != bytes32(0)
            ) {
                isRegisteredVoter[voters[i]] = true;
                voterIdHash[voters[i]] = hashes[i];
                registeredAt[voters[i]] = block.timestamp;
                voterList.push(voters[i]);
                voterCount++;
                emit VoterRegistered(
                    voters[i],
                    hashes[i],
                    block.timestamp
                );
            }
        }
        emit BatchRegistered(voters.length, block.timestamp);
    }

    function addRegistrar(address registrar)
        external onlyOwner {
        isRegistrar[registrar] = true;
        emit RegistrarAdded(registrar);
    }

    function removeRegistrar(address registrar)
        external onlyOwner {
        isRegistrar[registrar] = false;
        emit RegistrarRemoved(registrar);
    }

    // Revoke voter (deceased, ineligible)
    function revokeVoter(address voter) external onlyOwner {
        require(isRegisteredVoter[voter], "Not registered");
        isRegisteredVoter[voter] = false;
        emit VoterRevoked(voter, block.timestamp);
    }

    // Read functions
    function getVoterCount()
        external view returns (uint256) {
        return voterCount;
    }

    function getAllVoters()
        external view returns (address[] memory) {
        return voterList;
    }

    function getVoterInfo(address voter)
        external view returns (
            bool registered,
            bytes32 idHash,
            uint256 since
        )
    {
        return (
            isRegisteredVoter[voter],
            voterIdHash[voter],
            registeredAt[voter]
        );
    }

    function getVoterIdHash(address voter)
        external view returns (bytes32) {
        return voterIdHash[voter];
    }
}
