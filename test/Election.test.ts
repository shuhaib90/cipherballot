import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { VoterRegistry, Election } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Election", function () {
  let registry: VoterRegistry;
  let election: Election;
  let owner: HardhatEthersSigner; // Commission
  let voter1: HardhatEthersSigner;
  let voter2: HardhatEthersSigner;
  let unregistered: HardhatEthersSigner;
  let startTime: number;
  let endTime: number;

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs in FHEVM mock environment");
      this.skip();
    }

    [owner, voter1, voter2, unregistered] = await ethers.getSigners();

    // 1. Deploy VoterRegistry
    const VoterRegistryFactory = await ethers.getContractFactory("VoterRegistry");
    registry = (await VoterRegistryFactory.deploy()) as VoterRegistry;
    await registry.waitForDeployment();

    // Register voters
    const salt = "VOTER_SALT";
    const hash1 = ethers.solidityPackedKeccak256(["address", "string"], [voter1.address, salt]);
    const hash2 = ethers.solidityPackedKeccak256(["address", "string"], [voter2.address, salt]);
    
    await registry.registerVoter(voter1.address, hash1);
    await registry.registerVoter(voter2.address, hash2);

    // 2. Setup times
    const now = await time.latest();
    startTime = now + 60; // 1 min in future
    endTime = now + 3600; // 1 hour in future

    // 3. Deploy Election
    const ElectionFactory = await ethers.getContractFactory("Election");
    election = (await ElectionFactory.deploy(
      1,
      "Kerala General Election",
      "Confidential General Election",
      ["Alice", "Bob"],
      ["Party A", "Party B"],
      ["🌹", "⚡"],
      startTime,
      endTime,
      await registry.getAddress(),
      owner.address
    )) as Election;
    await election.waitForDeployment();

    // Assert coprocessor initialized (required by hardhat-plugin)
    await fhevm.assertCoprocessorInitialized(await election.getAddress(), "Election");
  });

  describe("constructor", function () {
    it("Should deploy with correct candidates", async function () {
      const candidates = await election.getAllCandidates();
      expect(candidates.length).to.equal(2);
      expect(candidates[0].name).to.equal("Alice");
      expect(candidates[0].symbol).to.equal("🌹");
      expect(candidates[1].name).to.equal("Bob");
      expect(candidates[1].symbol).to.equal("⚡");
    });

    it("Should reject end time in past", async function () {
      const now = await time.latest();
      const ElectionFactory = await ethers.getContractFactory("Election");
      await expect(
        ElectionFactory.deploy(
          2,
          "Past Election",
          "Desc",
          ["Alice", "Bob"],
          ["Party A", "Party B"],
          ["🌹", "⚡"],
          now - 100,
          now - 50,
          await registry.getAddress(),
          owner.address
        )
      ).to.be.revertedWith("End time in past");
    });
  });

  describe("castVote", function () {
    it("Should reject vote before start time", async function () {
      const choice = 0; // vote for Alice
      const encryptedChoice = await fhevm.encryptUint(
        FhevmType.euint8,
        choice,
        await election.getAddress(),
        voter1.address
      );

      await expect(
        election
          .connect(voter1)
          .castVote(encryptedChoice.externalEuint, encryptedChoice.inputProof)
      ).to.be.revertedWith("Election not started");
    });

    it("Should allow registered voter to vote once start time passes", async function () {
      // Warp to start time
      await time.increaseTo(startTime + 1);

      const choice = 0;
      const encryptedChoice = await fhevm.encryptUint(
        FhevmType.euint8,
        choice,
        await election.getAddress(),
        voter1.address
      );

      await expect(
        election
          .connect(voter1)
          .castVote(encryptedChoice.externalEuint, encryptedChoice.inputProof)
      )
        .to.emit(election, "VoteCast")
        .withArgs(voter1.address, 1, anyUint => true);

      expect(await election.hasVoted(voter1.address)).to.be.true;
      expect(await election.totalVotesCast()).to.equal(1);
    });

    it("Should reject unregistered voter", async function () {
      await time.increaseTo(startTime + 1);

      const choice = 0;
      const encryptedChoice = await fhevm.encryptUint(
        FhevmType.euint8,
        choice,
        await election.getAddress(),
        unregistered.address
      );

      await expect(
        election
          .connect(unregistered)
          .castVote(encryptedChoice.externalEuint, encryptedChoice.inputProof)
      ).to.be.revertedWith("Not a registered voter");
    });

    it("Should reject double vote from same address", async function () {
      await time.increaseTo(startTime + 1);

      const choice = 0;
      const encryptedChoice = await fhevm.encryptUint(
        FhevmType.euint8,
        choice,
        await election.getAddress(),
        voter1.address
      );

      // Vote 1
      await election
        .connect(voter1)
        .castVote(encryptedChoice.externalEuint, encryptedChoice.inputProof);

      // Vote 2 (with new encryption)
      const encryptedChoice2 = await fhevm.encryptUint(
        FhevmType.euint8,
        choice,
        await election.getAddress(),
        voter1.address
      );

      await expect(
        election
          .connect(voter1)
          .castVote(encryptedChoice2.externalEuint, encryptedChoice2.inputProof)
      ).to.be.revertedWith("Already voted in this election");
    });

    it("Should correctly tally votes via FHE", async function () {
      await time.increaseTo(startTime + 1);

      // Voter 1 votes for candidate 0 (Alice)
      const encryptedChoice1 = await fhevm.encryptUint(
        FhevmType.euint8,
        0,
        await election.getAddress(),
        voter1.address
      );
      await election
        .connect(voter1)
        .castVote(encryptedChoice1.externalEuint, encryptedChoice1.inputProof);

      // Voter 2 votes for candidate 1 (Bob)
      const encryptedChoice2 = await fhevm.encryptUint(
        FhevmType.euint8,
        1,
        await election.getAddress(),
        voter2.address
      );
      await election
        .connect(voter2)
        .castVote(encryptedChoice2.externalEuint, encryptedChoice2.inputProof);

      // Use debugger to check encrypted tallies
      const handles = await election.getEncryptedTallyHandles();
      const tallyAlice = await fhevm.debugger.decryptEuint(FhevmType.euint32, handles[0]);
      const tallyBob = await fhevm.debugger.decryptEuint(FhevmType.euint32, handles[1]);

      expect(tallyAlice).to.equal(1n);
      expect(tallyBob).to.equal(1n);
    });
  });

  describe("revealResults", function () {
    beforeEach(async function () {
      await time.increaseTo(startTime + 1);

      // Voter 1 votes for Alice (0)
      const encryptedChoice1 = await fhevm.encryptUint(
        FhevmType.euint8,
        0,
        await election.getAddress(),
        voter1.address
      );
      await election
        .connect(voter1)
        .castVote(encryptedChoice1.externalEuint, encryptedChoice1.inputProof);

      // Voter 2 votes for Alice (0)
      const encryptedChoice2 = await fhevm.encryptUint(
        FhevmType.euint8,
        0,
        await election.getAddress(),
        voter2.address
      );
      await election
        .connect(voter2)
        .castVote(encryptedChoice2.externalEuint, encryptedChoice2.inputProof);
    });

    it("Should reject reveal before deadline", async function () {
      await expect(election.requestRevealResults()).to.be.revertedWith("Election still open");
    });

    it("Should allow reveal after deadline and verify winner", async function () {
      // Warp to after end time
      await time.increaseTo(endTime + 1);

      // 1. Request reveal
      await expect(election.requestRevealResults())
        .to.emit(election, "ResultsRevealRequested");

      // 2. Fetch handles and mock decryption
      const handles = await election.getEncryptedTallyHandles();
      const results = await fhevm.publicDecrypt(handles);
      
      const decryptedTallies = [
        Number(results.clearValues[handles[0]]),
        Number(results.clearValues[handles[1]])
      ];

      // 3. Finalize
      await expect(election.finalizeRevealResults(decryptedTallies, results.decryptionProof))
        .to.emit(election, "ResultsRevealed")
        .withArgs(1, decryptedTallies, anyUint => true);

      expect(await election.resultsRevealed()).to.be.true;

      const finalResults = await election.getResults();
      expect(finalResults[0]).to.equal(2);
      expect(finalResults[1]).to.equal(0);

      // Check winner info
      const winner = await election.getWinner();
      expect(winner.winnerIndex).to.equal(0);
      expect(winner.winnerName).to.equal("Alice");
      expect(winner.winnerVotes).to.equal(2);
    });
  });
});
