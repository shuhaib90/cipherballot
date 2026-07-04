import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Using Deployer Wallet to test flow:", deployer.address);

  // Generate a random wallet for the citizen
  const citizenWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  console.log("Generated random citizen wallet:", citizenWallet.address);

  const registryAddress = "0xD02aF7E1D3fED9E340174B35Dc71728cc3b1ceB0";
  const voterPassAddress = "0x23619975B7577945Cc7AB51D2E4ea1e6f4468Bfe";
  const identityRegistryAddress = "0x6FFFfA1A5CD5B6952Fcf9bcE5E3465a98565B8f1";

  const registry = await ethers.getContractAt("VoterRegistry", registryAddress);
  const voterPass = await ethers.getContractAt("VoterEligibilityPass", voterPassAddress);
  const identityRegistry = await ethers.getContractAt("FHEIdentityRegistry", identityRegistryAddress);

  // Send some ETH to the citizen wallet for transaction gas
  console.log("Funding citizen wallet with 0.01 Sepolia ETH...");
  const fundTx = await deployer.sendTransaction({
    to: citizenWallet.address,
    value: ethers.parseEther("0.01")
  });
  await fundTx.wait();
  console.log("Funding transaction completed.");

  // Check if citizen is registered in VoterRegistry
  const isReg = await registry.isRegisteredVoter(citizenWallet.address);
  console.log("Is citizen registered voter?", isReg);

  // Check citizen status on FHEIdentityRegistry
  const status = await identityRegistry.getCitizenStatus(citizenWallet.address);
  console.log("Citizen status before submission:");
  console.log("- isVerified:", status.isVerified);
  console.log("- isPending:", status.isPending);

  // 1. Submit identity request (signed by the citizen wallet itself!)
  console.log("\nSubmitting identity request from citizen wallet...");
  const commitmentHash = ethers.id("test_commitment_" + Date.now());
  const mockChunk = ethers.ZeroHash;
  const mockProof = "0x";
  
  const submitTx = await identityRegistry.connect(citizenWallet).submitIdentityRequest(
    [mockChunk],
    [mockProof],
    mockChunk,
    mockProof,
    commitmentHash,
    { gasLimit: 300000 }
  );
  await submitTx.wait();
  console.log("Identity request submitted successfully!");

  // Get request ID
  const newStatus = await identityRegistry.getCitizenStatus(citizenWallet.address);
  const reqId = Number(newStatus.requestId);
  console.log("Request ID:", reqId);
  console.log("- isPending:", newStatus.isPending);

  // 2. Approve request (signed by the deployer as commissioner)
  console.log("\nApproving request #", reqId, "using Commissioner deployer wallet...");
  
  // Generate signature for electionId = 0 (global)
  const msgHash = ethers.solidityPackedKeccak256(
    ["address", "uint256", "bytes32"],
    [citizenWallet.address, 0, commitmentHash]
  );
  // Commissioner signs the approval hash
  const signature = await deployer.signMessage(ethers.getBytes(msgHash));
  console.log("Generated Commissioner Signature:", signature);

  const approveTx = await identityRegistry.connect(deployer).approveIdentityRequest(reqId, signature, { gasLimit: 400000 });
  await approveTx.wait();
  console.log("Request approved successfully!");

  // Check updated citizen status
  const finalStatus = await identityRegistry.getCitizenStatus(citizenWallet.address);
  console.log("\nUpdated Citizen Status:");
  console.log("- isVerified:", finalStatus.isVerified);
  console.log("- isPending:", finalStatus.isPending);
  console.log("- isRegistered:", finalStatus.isRegistered);
  console.log("- requestId:", finalStatus.requestId.toString());

  const savedSignature = await identityRegistry.approvedSignatures(finalStatus.requestId);
  console.log("- Saved Signature in Contract:", savedSignature);

  // 3. Mint the Voter Pass NFT! (called by the citizen wallet!)
  console.log("\nMinting VEPass NFT for citizen...");
  const mockHandle = ethers.ZeroHash;
  const mockProofHandle = "0x";
  
  const mintTx = await voterPass.connect(citizenWallet).mintVoterPass(
    citizenWallet.address,
    1,
    mockHandle,
    mockProofHandle,
    mockHandle,
    mockProofHandle,
    commitmentHash,
    savedSignature,
    { gasLimit: 500000 }
  );
  await mintTx.wait();
  console.log("VEPass NFT minted successfully!");

  const holdsPass = await voterPass.verifyVoterPass(citizenWallet.address, 1);
  console.log("Verification check: does citizen hold pass now?", holdsPass);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
