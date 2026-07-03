import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { VoterRegistry, FHEIdentityRegistry } from "../types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("FHEIdentityRegistry", function () {
  let voterRegistry: VoterRegistry;
  let identityRegistry: FHEIdentityRegistry;
  let owner: HardhatEthersSigner;
  let commission: HardhatEthersSigner;
  let citizen1: HardhatEthersSigner;
  let citizen2: HardhatEthersSigner;
  let nonOwner: HardhatEthersSigner;

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn("This test suite runs in FHEVM mock environment");
      this.skip();
    }

    [owner, commission, citizen1, citizen2, nonOwner] = await ethers.getSigners();

    // 1. Deploy VoterRegistry
    const VoterRegistryFactory = await ethers.getContractFactory("VoterRegistry");
    voterRegistry = (await VoterRegistryFactory.deploy()) as VoterRegistry;
    await voterRegistry.waitForDeployment();

    // 1.5. Deploy VoterEligibilityPass
    const VoterEligibilityPassFactory = await ethers.getContractFactory("VoterEligibilityPass");
    const voterPass = await VoterEligibilityPassFactory.deploy(commission.address);
    await voterPass.waitForDeployment();

    // 2. Deploy FHEIdentityRegistry
    const FHEIdentityRegistryFactory = await ethers.getContractFactory("FHEIdentityRegistry");
    identityRegistry = (await FHEIdentityRegistryFactory.deploy(
      await voterRegistry.getAddress(),
      commission.address,
      await voterPass.getAddress()
    )) as FHEIdentityRegistry;
    await identityRegistry.waitForDeployment();

    // Authorize FHEIdentityRegistry as minter in VoterEligibilityPass
    await voterPass.setAuthorizedMinter(await identityRegistry.getAddress(), true);

    // Assert coprocessor initialized (required by hardhat-plugin)
    await fhevm.assertCoprocessorInitialized(await identityRegistry.getAddress(), "FHEIdentityRegistry");

    // 3. Grant registrar role to FHEIdentityRegistry
    await voterRegistry.addRegistrar(await identityRegistry.getAddress());
  });

  async function prepareDocSubmission(
    citizen: HardhatEthersSigner,
    docTypeVal: number,
    chunks: bigint[],
    commitmentStr: string
  ) {
    const encryptedChunks = [];
    const inputProofs = [];
    const registryAddr = await identityRegistry.getAddress();

    for (const chunk of chunks) {
      const enc = await fhevm.encryptUint(
        FhevmType.euint256,
        chunk,
        registryAddr,
        citizen.address
      );
      encryptedChunks.push(enc.externalEuint);
      inputProofs.push(enc.inputProof);
    }

    const encDocType = await fhevm.encryptUint(
      FhevmType.euint8,
      docTypeVal,
      registryAddr,
      citizen.address
    );

    const commitmentHash = ethers.keccak256(ethers.toUtf8Bytes(commitmentStr));

    return {
      encryptedChunks,
      inputProofs,
      encryptedDocTypeVal: encDocType.externalEuint,
      docTypeProof: encDocType.inputProof,
      commitmentHash
    };
  }

  describe("submitIdentityRequest", function () {
    it("Should accept valid encrypted submission", async function () {
      const chunks = [12345n, 67890n];
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 1, chunks, "my_national_id_doc");

      await expect(
        identityRegistry
          .connect(citizen1)
          .submitIdentityRequest(
            encryptedChunks,
            inputProofs,
            encryptedDocTypeVal,
            docTypeProof,
            commitmentHash
          )
      )
        .to.emit(identityRegistry, "IdentityRequestSubmitted")
        .withArgs(0, citizen1.address, 2, anyUint => true);

      const status = await identityRegistry.getCitizenStatus(citizen1.address);
      expect(status.isVerified).to.be.false;
      expect(status.isPending).to.be.true;
      expect(status.isRegistered).to.be.false;
      expect(status.requestId).to.equal(0n);
      expect(status.status).to.equal(0n); // RequestStatus.Pending
      expect(status.rejectionReason).to.equal("");

      expect(await identityRegistry.getPendingCount()).to.equal(1);
      expect(await identityRegistry.getEncryptedChunkCount(0)).to.equal(2);
    });

    it("Should reject if already registered voter", async function () {
      const hash = ethers.id("already_registered");
      await voterRegistry.registerVoter(citizen1.address, hash);

      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 1, [100n], "already_registered");

      await expect(
        identityRegistry
          .connect(citizen1)
          .submitIdentityRequest(
            encryptedChunks,
            inputProofs,
            encryptedDocTypeVal,
            docTypeProof,
            commitmentHash
          )
      ).to.be.revertedWith("Already registered voter");
    });

    it("Should reject duplicate pending request", async function () {
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 1, [100n], "dup_req");

      await identityRegistry
        .connect(citizen1)
        .submitIdentityRequest(
          encryptedChunks,
          inputProofs,
          encryptedDocTypeVal,
          docTypeProof,
          commitmentHash
        );

      await expect(
        identityRegistry
          .connect(citizen1)
          .submitIdentityRequest(
            encryptedChunks,
            inputProofs,
            encryptedDocTypeVal,
            docTypeProof,
            commitmentHash
          )
      ).to.be.revertedWith("Request already pending");
    });

    it("Should reject if already verified", async function () {
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 1, [100n], "req");

      await identityRegistry
        .connect(citizen1)
        .submitIdentityRequest(
          encryptedChunks,
          inputProofs,
          encryptedDocTypeVal,
          docTypeProof,
          commitmentHash
        );

      await identityRegistry.connect(commission).approveIdentityRequest(0);

      const {
        encryptedChunks: enc2,
        inputProofs: proofs2,
        encryptedDocTypeVal: type2,
        docTypeProof: typeProof2,
        commitmentHash: commit2
      } = await prepareDocSubmission(citizen1, 1, [100n], "req2");

      await expect(
        identityRegistry
          .connect(citizen1)
          .submitIdentityRequest(enc2, proofs2, type2, typeProof2, commit2)
      ).to.be.revertedWith("Already verified");
    });

    it("Should reject empty chunks array", async function () {
      const {
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 1, [], "empty");

      await expect(
        identityRegistry
          .connect(citizen1)
          .submitIdentityRequest(
            [],
            [],
            encryptedDocTypeVal,
            docTypeProof,
            commitmentHash
          )
      ).to.be.revertedWith("No document data");
    });

    it("Should reject > MAX_DOC_CHUNKS chunks", async function () {
      const largeChunks = Array(11).fill(100n);
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 1, largeChunks, "too_large");

      await expect(
        identityRegistry
          .connect(citizen1)
          .submitIdentityRequest(
            encryptedChunks,
            inputProofs,
            encryptedDocTypeVal,
            docTypeProof,
            commitmentHash
          )
      ).to.be.revertedWith("Document too large");
    });

    it("Should reject proof/chunk length mismatch", async function () {
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 1, [100n, 200n], "mismatch");

      await expect(
        identityRegistry
          .connect(citizen1)
          .submitIdentityRequest(
            encryptedChunks,
            [inputProofs[0]],
            encryptedDocTypeVal,
            docTypeProof,
            commitmentHash
          )
      ).to.be.revertedWith("Proof mismatch");
    });

    it("Should reject zero commitment hash", async function () {
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof
      } = await prepareDocSubmission(citizen1, 1, [100n], "zero_commit");

      await expect(
        identityRegistry
          .connect(citizen1)
          .submitIdentityRequest(
            encryptedChunks,
            inputProofs,
            encryptedDocTypeVal,
            docTypeProof,
            ethers.ZeroHash
          )
      ).to.be.revertedWith("Commitment required");
    });
  });

  describe("approveIdentityRequest", function () {
    beforeEach(async function () {
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 1, [100n], "approve_test");

      await identityRegistry
        .connect(citizen1)
        .submitIdentityRequest(
          encryptedChunks,
          inputProofs,
          encryptedDocTypeVal,
          docTypeProof,
          commitmentHash
        );
    });

    it("Should auto-register voter in VoterRegistry", async function () {
      await expect(identityRegistry.connect(commission).approveIdentityRequest(0))
        .to.emit(identityRegistry, "IdentityRequestApproved")
        .withArgs(0, citizen1.address, commission.address, anyUint => true)
        .to.emit(identityRegistry, "VoterAutoRegistered")
        .withArgs(0, citizen1.address, anyUint => true);

      expect(await voterRegistry.isRegisteredVoter(citizen1.address)).to.be.true;

      const status = await identityRegistry.getCitizenStatus(citizen1.address);
      expect(status.isVerified).to.be.true;
      expect(status.isPending).to.be.false;
      expect(status.isRegistered).to.be.true;
      expect(status.status).to.equal(1n); // RequestStatus.Approved
    });

    it("Should remove from pending list", async function () {
      expect(await identityRegistry.getPendingCount()).to.equal(1);
      await identityRegistry.connect(commission).approveIdentityRequest(0);
      expect(await identityRegistry.getPendingCount()).to.equal(0);
    });

    it("Should reject non-commission caller", async function () {
      await expect(
        identityRegistry.connect(nonOwner).approveIdentityRequest(0)
      ).to.be.revertedWith("Only Election Commission");
    });

    it("Should reject non-pending request", async function () {
      await identityRegistry.connect(commission).approveIdentityRequest(0);
      await expect(
        identityRegistry.connect(commission).approveIdentityRequest(0)
      ).to.be.revertedWith("Not pending");
    });

    it("Should reject expired request", async function () {
      await time.increase(30 * 24 * 3600 + 1); // Exceed REQUEST_EXPIRY
      await expect(
        identityRegistry.connect(commission).approveIdentityRequest(0)
      ).to.be.revertedWith("Request expired");
    });
  });

  describe("rejectIdentityRequest", function () {
    beforeEach(async function () {
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 1, [100n], "reject_test");

      await identityRegistry
        .connect(citizen1)
        .submitIdentityRequest(
          encryptedChunks,
          inputProofs,
          encryptedDocTypeVal,
          docTypeProof,
          commitmentHash
        );
    });

    it("Should update status to Rejected and store reason", async function () {
      const reason = "Document ID number is blurred";
      await expect(identityRegistry.connect(commission).rejectIdentityRequest(0, reason))
        .to.emit(identityRegistry, "IdentityRequestRejected")
        .withArgs(0, citizen1.address, commission.address, reason, anyUint => true);

      const status = await identityRegistry.getCitizenStatus(citizen1.address);
      expect(status.isVerified).to.be.false;
      expect(status.isPending).to.be.false;
      expect(status.isRegistered).to.be.false;
      expect(status.status).to.equal(2n); // RequestStatus.Rejected
      expect(status.rejectionReason).to.equal(reason);
    });

    it("Should reject reason < 10 chars", async function () {
      await expect(
        identityRegistry.connect(commission).rejectIdentityRequest(0, "short")
      ).to.be.revertedWith("Reason required (min 10 chars)");
    });

    it("Should reject non-commission caller", async function () {
      await expect(
        identityRegistry.connect(nonOwner).rejectIdentityRequest(0, "Valid rejection reason string")
      ).to.be.revertedWith("Only Election Commission");
    });
  });

  describe("resubmitIdentityRequest", function () {
    beforeEach(async function () {
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 1, [100n], "resubmit_test");

      await identityRegistry
        .connect(citizen1)
        .submitIdentityRequest(
          encryptedChunks,
          inputProofs,
          encryptedDocTypeVal,
          docTypeProof,
          commitmentHash
        );

      await identityRegistry.connect(commission).rejectIdentityRequest(0, "Please submit valid driving license");
    });

    it("Should allow resubmit after rejection", async function () {
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen1, 2, [200n], "new_passport_doc");

      await expect(
        identityRegistry
          .connect(citizen1)
          .resubmitIdentityRequest(
            encryptedChunks,
            inputProofs,
            encryptedDocTypeVal,
            docTypeProof,
            commitmentHash
          )
      )
        .to.emit(identityRegistry, "IdentityRequestSubmitted")
        .withArgs(1, citizen1.address, 1, anyUint => true);

      const status = await identityRegistry.getCitizenStatus(citizen1.address);
      expect(status.isVerified).to.be.false;
      expect(status.isPending).to.be.true;
      expect(status.isRegistered).to.be.false;
      expect(status.requestId).to.equal(1n);
      expect(status.status).to.equal(0n); // Pending
    });

    it("Should reject resubmit if not rejected", async function () {
      const {
        encryptedChunks,
        inputProofs,
        encryptedDocTypeVal,
        docTypeProof,
        commitmentHash
      } = await prepareDocSubmission(citizen2, 1, [100n], "citizen2_req");

      await identityRegistry
        .connect(citizen2)
        .submitIdentityRequest(
          encryptedChunks,
          inputProofs,
          encryptedDocTypeVal,
          docTypeProof,
          commitmentHash
        );

      await expect(
        identityRegistry
          .connect(citizen2)
          .resubmitIdentityRequest(
            encryptedChunks,
            inputProofs,
            encryptedDocTypeVal,
            docTypeProof,
            commitmentHash
          )
      ).to.be.revertedWith("Can only resubmit after rejection");
    });
  });

  describe("VoterRegistry REGISTRAR role", function () {
    it("Should allow owner to add and remove registrars", async function () {
      expect(await voterRegistry.isRegistrar(nonOwner.address)).to.be.false;
      await expect(voterRegistry.addRegistrar(nonOwner.address))
        .to.emit(voterRegistry, "RegistrarAdded")
        .withArgs(nonOwner.address);
      expect(await voterRegistry.isRegistrar(nonOwner.address)).to.be.true;

      await expect(voterRegistry.removeRegistrar(nonOwner.address))
        .to.emit(voterRegistry, "RegistrarRemoved")
        .withArgs(nonOwner.address);
      expect(await voterRegistry.isRegistrar(nonOwner.address)).to.be.false;
    });

    it("Should prevent non-owners from adding registrars", async function () {
      await expect(
        voterRegistry.connect(nonOwner).addRegistrar(nonOwner.address)
      ).to.be.reverted;
    });

    it("Should allow registrar to register voter", async function () {
      // Add nonOwner as registrar
      await voterRegistry.addRegistrar(nonOwner.address);

      const hash = ethers.id("some_id");
      await expect(
        voterRegistry.connect(nonOwner).registerVoter(citizen2.address, hash)
      ).to.emit(voterRegistry, "VoterRegistered");

      expect(await voterRegistry.isRegisteredVoter(citizen2.address)).to.be.true;
    });

    it("Should prevent non-registrar from registering voter", async function () {
      const hash = ethers.id("some_id");
      await expect(
        voterRegistry.connect(nonOwner).registerVoter(citizen2.address, hash)
      ).to.be.revertedWith("Not authorized");
    });
  });
});
