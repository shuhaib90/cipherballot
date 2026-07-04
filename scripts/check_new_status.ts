import { ethers } from "hardhat";

async function main() {
  const targetAddress = "0x8b7a0dab6a28055ee4b872a74b6f059008789ec3";
  console.log("Analyzing wallet address:", targetAddress);

  // 1. OLD DEPLOYMENT (the one with the uninitialized index 0 leak)
  const oldRegistryAddress = "0x16b080517f9e7b61f58c47dc699ac88507c4f5bb"; // wait, let's look up old addresses
  // Let's check old address from git history or previous files if we have them, or check the new deployment
  
  // 2. NEW DEPLOYMENT (from task-4441, the latest one)
  const newRegistryAddress = "0xd2178C19f7025C52B9F4fF35B2A6cB6d95391b89";
  const newPassAddress = "0x1F658b510a0c0DD514e2a3876BA1Db1e3d5B4E46";
  const newIdentityRegistryAddress = "0xE1240E7fB382ccD619699388033990Ae35A65718";

  console.log("\n=== Checking on NEW Contracts ===");
  const newRegistry = await ethers.getContractAt("VoterRegistry", newRegistryAddress);
  const newPass = await ethers.getContractAt("VoterEligibilityPass", newPassAddress);
  const newIdentityRegistry = await ethers.getContractAt("FHEIdentityRegistry", newIdentityRegistryAddress);

  const isRegNew = await newRegistry.isRegisteredVoter(targetAddress);
  console.log("Is registered in VoterRegistry (NEW)?", isRegNew);

  const hasPassNew = await newPass.verifyVoterPass(targetAddress, 1);
  console.log("Does have Voter Pass NFT for electionId 1 (NEW)?", hasPassNew);

  const statusNew = await newIdentityRegistry.getCitizenStatus(targetAddress);
  console.log("Citizen Status (NEW):");
  console.log("- isVerified:", statusNew.isVerified);
  console.log("- isPending:", statusNew.isPending);
  console.log("- requestId:", statusNew.requestId.toString());
  console.log("- status (0=Pending, 1=Approved, 2=Rejected):", statusNew.status.toString());

  // Let's also check if the mapping has any signature for request ID
  const savedSig = await newIdentityRegistry.approvedSignatures(statusNew.requestId);
  console.log("- Signature for requestId in NEW contract:", savedSig);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
