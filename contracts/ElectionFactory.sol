// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./Election.sol";
import "./VoterRegistry.sol";

contract ElectionFactory is Ownable {

    VoterRegistry public immutable voterRegistry;
    address public immutable voterPassContract;
    address[] public elections;
    uint256 public electionCount;
    
    mapping(address => bool) public isDeployedElection;

    event ElectionDeployed(
        uint256 indexed electionId,
        address indexed electionAddress,
        string name,
        uint256 startTime,
        uint256 endTime
    );

    constructor(address _voterRegistry, address _voterPassContract)
        Ownable(msg.sender)
    {
        require(_voterRegistry != address(0), "Invalid registry");
        require(_voterPassContract != address(0), "Invalid pass contract");
        voterRegistry = VoterRegistry(_voterRegistry);
        voterPassContract = _voterPassContract;
    }

    function createElection(
        string calldata name,
        string calldata description,
        string[] calldata candidateNames,
        string[] calldata candidateParties,
        string[] calldata candidateSymbols,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner returns (address) {
        require(bytes(name).length > 0, "Name required");
        require(
            candidateNames.length >= 2,
            "Min 2 candidates"
        );
        require(
            candidateNames.length <= 10,
            "Max 10 candidates"
        );
        require(
            startTime < endTime,
            "Invalid time range"
        );

        uint256 id = electionCount++;

        Election election = new Election(
            id,
            name,
            description,
            candidateNames,
            candidateParties,
            candidateSymbols,
            startTime,
            endTime,
            address(voterRegistry),
            msg.sender,  // commission = factory owner
            voterPassContract // NEW
        );

        isDeployedElection[address(election)] = true;
        elections.push(address(election));

        emit ElectionDeployed(
            id,
            address(election),
            name,
            startTime,
            endTime
        );

        return address(election);
    }

    function getElectionCount()
        external view returns (uint256) {
        return electionCount;
    }

    function getAllElections()
        external view returns (address[] memory) {
        return elections;
    }

    function getElection(uint256 index)
        external view returns (address) {
        require(index < electionCount, "Invalid index");
        return elections[index];
    }
}
