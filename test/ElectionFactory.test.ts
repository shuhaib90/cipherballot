import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { VoterRegistry, ElectionFactory } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ElectionFactory", function () {
  let registry: VoterRegistry;
  let factory: ElectionFactory;
  let owner: HardhatEthersSigner;
  let nonOwner: HardhatEthersSigner;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    nonOwner = signers[1];
    
    const VoterRegistryFactory = await ethers.getContractFactory("VoterRegistry");
    registry = (await VoterRegistryFactory.deploy()) as VoterRegistry;
    await registry.waitForDeployment();

    const VoterEligibilityPassFactory = await ethers.getContractFactory("VoterEligibilityPass");
    const voterPass = await VoterEligibilityPassFactory.deploy(owner.address);
    await voterPass.waitForDeployment();

    const ElectionFactoryFactory = await ethers.getContractFactory("ElectionFactory");
    factory = (await ElectionFactoryFactory.deploy(
      await registry.getAddress(),
      await voterPass.getAddress()
    )) as ElectionFactory;
    await factory.waitForDeployment();
  });

  describe("createElection", function () {
    it("Should deploy new Election contract", async function () {
      const now = await time.latest();
      const startTime = now + 10;
      const endTime = now + 500;

      const tx = await factory.createElection(
        "Kerala Panchayat 2026",
        "Panchayat Confidential Election",
        ["Alice", "Bob"],
        ["Party A", "Party B"],
        ["🌹", "⚡"],
        startTime,
        endTime
      );

      await expect(tx).to.emit(factory, "ElectionDeployed");
      expect(await factory.electionCount()).to.equal(1);
      
      const electionAddress = await factory.getElection(0);
      expect(electionAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should reject non-owner call", async function () {
      const now = await time.latest();
      const startTime = now + 10;
      const endTime = now + 500;

      await expect(
        factory.connect(nonOwner).createElection(
          "Kerala Panchayat 2026",
          "Panchayat Confidential Election",
          ["Alice", "Bob"],
          ["Party A", "Party B"],
          ["🌹", "⚡"],
          startTime,
          endTime
        )
      ).to.be.reverted;
    });

    it("Should reject < 2 candidates", async function () {
      const now = await time.latest();
      const startTime = now + 10;
      const endTime = now + 500;

      await expect(
        factory.createElection(
          "Kerala Panchayat 2026",
          "Panchayat Confidential Election",
          ["Alice"],
          ["Party A"],
          ["🌹"],
          startTime,
          endTime
        )
      ).to.be.revertedWith("Min 2 candidates");
    });
  });

  describe("getAllElections", function () {
    it("Should return empty array initially", async function () {
      const elections = await factory.getAllElections();
      expect(elections.length).to.equal(0);
    });

    it("Should return all deployed elections", async function () {
      const now = await time.latest();
      const startTime = now + 10;
      const endTime = now + 500;

      await factory.createElection(
        "Election 1",
        "Desc 1",
        ["Alice", "Bob"],
        ["Party A", "Party B"],
        ["🌹", "⚡"],
        startTime,
        endTime
      );

      await factory.createElection(
        "Election 2",
        "Desc 2",
        ["Charlie", "Dave"],
        ["Party C", "Party D"],
        ["🌟", "🍀"],
        startTime,
        endTime
      );

      const elections = await factory.getAllElections();
      expect(elections.length).to.equal(2);
      expect(elections[0]).to.equal(await factory.getElection(0));
      expect(elections[1]).to.equal(await factory.getElection(1));
    });
  });
});
