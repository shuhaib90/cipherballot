import { expect } from "chai";
import { ethers } from "hardhat";
import { VoterRegistry } from "../types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VoterRegistry", function () {
  let registry: VoterRegistry;
  let owner: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;
  let nonOwner: SignerWithAddress;

  beforeEach(async function () {
    [owner, voter1, voter2, nonOwner] = await ethers.getSigners();
    const VoterRegistryFactory = await ethers.getContractFactory("VoterRegistry");
    registry = (await VoterRegistryFactory.deploy()) as VoterRegistry;
    await registry.waitForDeployment();
  });

  describe("registerVoter", function () {
    it("Should register voter with valid hash", async function () {
      const hash = ethers.id("voter1_national_id");
      await expect(registry.registerVoter(voter1.address, hash))
        .to.emit(registry, "VoterRegistered")
        .withArgs(voter1.address, hash, anyUint => true);

      const info = await registry.getVoterInfo(voter1.address);
      expect(info.registered).to.be.true;
      expect(info.idHash).to.equal(hash);
      expect(await registry.getVoterCount()).to.equal(1);
    });

    it("Should reject zero address", async function () {
      const hash = ethers.id("voter1_national_id");
      await expect(
        registry.registerVoter(ethers.ZeroAddress, hash)
      ).to.be.revertedWith("Zero address");
    });

    it("Should reject zero hash", async function () {
      await expect(
        registry.registerVoter(voter1.address, ethers.ZeroHash)
      ).to.be.revertedWith("Invalid hash");
    });

    it("Should reject duplicate registration", async function () {
      const hash = ethers.id("voter1_national_id");
      await registry.registerVoter(voter1.address, hash);
      await expect(
        registry.registerVoter(voter1.address, hash)
      ).to.be.revertedWith("Already registered");
    });

    it("Should reject non-owner call", async function () {
      const hash = ethers.id("voter1_national_id");
      await expect(
        registry.connect(nonOwner).registerVoter(voter1.address, hash)
      ).to.be.reverted; // OpenZeppelin OwnableUnauthorizedAccount
    });
  });

  describe("registerVotersBatch", function () {
    it("Should register multiple voters at once", async function () {
      const hash1 = ethers.id("voter1");
      const hash2 = ethers.id("voter2");
      
      await expect(
        registry.registerVotersBatch([voter1.address, voter2.address], [hash1, hash2])
      )
        .to.emit(registry, "BatchRegistered")
        .withArgs(2, anyUint => true);

      expect(await registry.isRegisteredVoter(voter1.address)).to.be.true;
      expect(await registry.isRegisteredVoter(voter2.address)).to.be.true;
      expect(await registry.getVoterCount()).to.equal(2);
    });

    it("Should reject length mismatch", async function () {
      const hash1 = ethers.id("voter1");
      await expect(
        registry.registerVotersBatch([voter1.address, voter2.address], [hash1])
      ).to.be.revertedWith("Length mismatch");
    });

    it("Should reject batch > 500", async function () {
      const addresses = Array(501).fill(voter1.address);
      const hashes = Array(501).fill(ethers.ZeroHash);
      await expect(
        registry.registerVotersBatch(addresses, hashes)
      ).to.be.revertedWith("Max 500 per batch");
    });

    it("Should skip already-registered addresses", async function () {
      const hash1 = ethers.id("voter1");
      const hash2 = ethers.id("voter2");

      await registry.registerVoter(voter1.address, hash1);
      
      // Batch registers voter1 (already registered) and voter2 (new)
      await registry.registerVotersBatch([voter1.address, voter2.address], [hash1, hash2]);

      expect(await registry.isRegisteredVoter(voter2.address)).to.be.true;
      expect(await registry.getVoterCount()).to.equal(2);
    });
  });

  describe("revokeVoter", function () {
    it("Should revoke registered voter", async function () {
      const hash = ethers.id("voter1");
      await registry.registerVoter(voter1.address, hash);

      await expect(registry.revokeVoter(voter1.address))
        .to.emit(registry, "VoterRevoked")
        .withArgs(voter1.address, anyUint => true);

      expect(await registry.isRegisteredVoter(voter1.address)).to.be.false;
    });

    it("Should reject non-registered voter", async function () {
      await expect(
        registry.revokeVoter(voter2.address)
      ).to.be.revertedWith("Not registered");
    });

    it("Should reject non-owner call", async function () {
      const hash = ethers.id("voter1");
      await registry.registerVoter(voter1.address, hash);
      await expect(
        registry.connect(nonOwner).revokeVoter(voter1.address)
      ).to.be.reverted;
    });
  });
});
