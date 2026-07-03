import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { VoterRegistry, VoterEligibilityPass, Election } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("VoterEligibilityPass", function () {
  let registry: VoterRegistry;
  let voterPass: VoterEligibilityPass;
  let election: Election;
  
  let owner: HardhatEthersSigner; 
  let commission: HardhatEthersSigner;
  let voter1: HardhatEthersSigner;
  let voter2: HardhatEthersSigner;
  let attacker: HardhatEthersSigner;

  const electionId = 1;
  const commitmentHash = ethers.id("commitment_data");

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs in FHEVM mock environment");
      this.skip();
    }

    [owner, commission, voter1, voter2, attacker] = await ethers.getSigners();

    // 1. Deploy VoterRegistry
    const VoterRegistryFactory = await ethers.getContractFactory("VoterRegistry");
    registry = (await VoterRegistryFactory.deploy()) as VoterRegistry;
    await registry.waitForDeployment();

    // Register voters
    const salt = "VOTER_SALT";
    const hash1 = ethers.solidityPackedKeccak256(["address", "string"], [voter1.address, salt]);
    await registry.registerVoter(voter1.address, hash1);

    // 2. Deploy VoterEligibilityPass
    const VoterEligibilityPassFactory = await ethers.getContractFactory("VoterEligibilityPass");
    voterPass = (await VoterEligibilityPassFactory.deploy(commission.address)) as VoterEligibilityPass;
    await voterPass.waitForDeployment();

    // 3. Deploy Demo Election
    const now = await time.latest();
    const startTime = now + 10;
    const endTime = now + 3600;

    const ElectionFactory = await ethers.getContractFactory("Election");
    election = (await ElectionFactory.deploy(
      electionId,
      "Kerala Panchayat Election 2026",
      "Confidential Voting Demo",
      ["Alice", "Bob"],
      ["Dev Party", "Progress alliance"],
      ["🌱", "⚡"],
      startTime,
      endTime,
      await registry.getAddress(),
      commission.address,
      await voterPass.getAddress()
    )) as Election;
    await election.waitForDeployment();

    // Configure ElectionFactory address in voterPass for caller checks (keep address(0) to skip factory checks in tests)
  });

  async function encryptInputs(value: bigint, docTypeVal: bigint, passAddr: string, voterAddr: string) {
    const encIdentity = await fhevm.encryptUint(
      FhevmType.euint256,
      value,
      passAddr,
      voterAddr
    );
    const encDocType = await fhevm.encryptUint(
      FhevmType.euint8,
      docTypeVal,
      passAddr,
      voterAddr
    );
    return {
      encryptedIdentity: encIdentity.externalEuint,
      identityProof: encIdentity.inputProof,
      encryptedDocType: encDocType.externalEuint,
      docTypeProof: encDocType.inputProof
    };
  }

  describe("Voter Pass Minting & Signature Verification", function () {
    it("Should mint a pass successfully with valid commission signature", async function () {
      // Create valid signature
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [voter1.address, electionId, commitmentHash]
      );
      const signature = await commission.signMessage(ethers.toBeArray(messageHash));

      // Mock encrypted FHE values
      const passAddr = await voterPass.getAddress();
      const enc = await encryptInputs(12345n, 1n, passAddr, voter1.address);

      await expect(
        voterPass.connect(voter1).mintVoterPass(
          voter1.address,
          electionId,
          enc.encryptedIdentity,
          enc.identityProof,
          enc.encryptedDocType,
          enc.docTypeProof,
          commitmentHash,
          signature
        )
      ).to.emit(voterPass, "VoterPassMinted");

      expect(await voterPass.ownerOf(1)).to.equal(voter1.address);
      
      const metadata = await voterPass.getPassMetadata(1);
      expect(metadata.commitmentHash).to.equal(commitmentHash);
      expect(metadata.electionId).to.equal(electionId);
      expect(metadata.originalMinter).to.equal(voter1.address);
      expect(metadata.isActive).to.be.true;
    });

    it("Should reject minting with invalid signature", async function () {
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [voter1.address, electionId, commitmentHash]
      );
      // Signed by attacker instead of commission
      const signature = await attacker.signMessage(ethers.toBeArray(messageHash));

      const passAddr = await voterPass.getAddress();
      const enc = await encryptInputs(12345n, 1n, passAddr, voter1.address);

      await expect(
        voterPass.connect(voter1).mintVoterPass(
          voter1.address,
          electionId,
          enc.encryptedIdentity,
          enc.identityProof,
          enc.encryptedDocType,
          enc.docTypeProof,
          commitmentHash,
          signature
        )
      ).to.be.revertedWith("Invalid commission signature");
    });
  });

  describe("Soulbound Restrictions", function () {
    beforeEach(async function () {
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [voter1.address, electionId, commitmentHash]
      );
      const signature = await commission.signMessage(ethers.toBeArray(messageHash));
      const passAddr = await voterPass.getAddress();
      const enc = await encryptInputs(12345n, 1n, passAddr, voter1.address);

      await voterPass.connect(voter1).mintVoterPass(
        voter1.address,
        electionId,
        enc.encryptedIdentity,
        enc.identityProof,
        enc.encryptedDocType,
        enc.docTypeProof,
        commitmentHash,
        signature
      );
    });

    it("Should block transferFrom", async function () {
      await expect(
        voterPass.connect(voter1).transferFrom(voter1.address, voter2.address, 1)
      ).to.be.revertedWith("VEPass is soulbound - transfer blocked");
    });

    it("Should block safeTransferFrom", async function () {
      await expect(
        voterPass.connect(voter1)["safeTransferFrom(address,address,uint256)"](
          voter1.address,
          voter2.address,
          1
        )
      ).to.be.revertedWith("VEPass is soulbound - transfer blocked");
    });
  });

  describe("Voting Verification & Integration", function () {
    beforeEach(async function () {
      const messageHash = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [voter1.address, electionId, commitmentHash]
      );
      const signature = await commission.signMessage(ethers.toBeArray(messageHash));
      const passAddr = await voterPass.getAddress();
      const enc = await encryptInputs(12345n, 1n, passAddr, voter1.address);

      await voterPass.connect(voter1).mintVoterPass(
        voter1.address,
        electionId,
        enc.encryptedIdentity,
        enc.identityProof,
        enc.encryptedDocType,
        enc.docTypeProof,
        commitmentHash,
        signature
      );
    });

    it("Should return true for verifyVoterPass if owned and active", async function () {
      expect(await voterPass.verifyVoterPass(voter1.address, electionId)).to.be.true;
    });

    it("Should return false for verifyVoterPass if not owned", async function () {
      expect(await voterPass.verifyVoterPass(voter2.address, electionId)).to.be.false;
    });

    it("Should reject voting if user does not own VEPass NFT", async function () {
      await time.increase(15);
      
      const electionAddr = await election.getAddress();
      const encChoice = await fhevm.encryptUint(
        FhevmType.euint8,
        0n,
        electionAddr,
        voter2.address
      );

      // voter2 has not minted VEPass NFT
      await expect(
        election.connect(voter2).castVote(encChoice.externalEuint, encChoice.inputProof)
      ).to.be.revertedWith("Invalid or missing Voter Pass NFT");
    });

    it("Should vote successfully if user owns VEPass NFT and mark pass as used", async function () {
      await time.increase(15);
      
      const electionAddr = await election.getAddress();
      const encChoice = await fhevm.encryptUint(
        FhevmType.euint8,
        0n,
        electionAddr,
        voter1.address
      );

      // Skip election factory check in test by keeping factory address as address(0)
      
      await expect(
        election.connect(voter1).castVote(encChoice.externalEuint, encChoice.inputProof)
      ).to.emit(election, "VoteCast");

      // Verify pass marked as used
      const meta = await voterPass.getPassMetadata(1);
      expect(meta.hasBeenUsedToVote).to.be.true;
    });
  });
});
