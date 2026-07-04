import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  
  const targetAddress = "0x5F2111006a35276034c8288948d80c3d15242F27";
  const officerAddress = "0x36e1C1EbC3e36d9b55E4b872A74B6F059008789e";
  console.log("Citizen Target Wallet:", targetAddress);
  
  const registryAddress = "0xD02aF7E1D3fED9E340174B35Dc71728cc3b1ceB0";
  const voterPassAddress = "0x23619975B7577945Cc7AB51D2E4ea1e6f4468Bfe";
  const identityRegistryAddress = "0x6FFFfA1A5CD5B6952Fcf9bcE5E3465a98565B8f1";

  const registry = await ethers.getContractAt("VoterRegistry", registryAddress);
  const voterPass = await ethers.getContractAt("VoterEligibilityPass", voterPassAddress);
  const identityRegistry = await ethers.getContractAt("FHEIdentityRegistry", identityRegistryAddress);

  console.log("\n=== Checking VoterRegistry ===");
  const isTargetRegistered = await registry.isRegisteredVoter(targetAddress);
  console.log("Is Citizen registered in VoterRegistry?", isTargetRegistered);
  
  const isDeployerRegistered = await registry.isRegisteredVoter(deployer.address);
  console.log("Is Deployer registered in VoterRegistry?", isDeployerRegistered);

  const voterCount = await registry.voterCount();
  console.log("Total registered voters count:", voterCount.toString());
  
  for (let i = 0; i < Number(voterCount); i++) {
    const v = await registry.voterList(i);
    console.log(`- Voter #${i}: ${v}`);
  }

  console.log("\n=== Checking VoterEligibilityPass ===");
  const commissionInPass = await voterPass.commissionAddress();
  console.log("VoterEligibilityPass Commission Address:", commissionInPass);
  const isDeployerSigner = await voterPass.isAuthorizedSigner(deployer.address);
  const isOfficerSigner = await voterPass.isAuthorizedSigner(officerAddress);
  console.log("Is Deployer authorized signer?", isDeployerSigner);
  console.log("Is Officer authorized signer?", isOfficerSigner);

  const tokenForElection1 = await voterPass.walletTokens(targetAddress, 1);
  console.log("VEPass Token for electionId=1:", tokenForElection1.toString());
  const tokenForElection0 = await voterPass.walletTokens(targetAddress, 0);
  console.log("VEPass Token for electionId=0:", tokenForElection0.toString());

  console.log("\n=== Checking FHEIdentityRegistry ===");
  const citizenStatus = await identityRegistry.getCitizenStatus(targetAddress);
  console.log("Citizen Status:");
  console.log("- isVerified:", citizenStatus.isVerified);
  console.log("- isPending:", citizenStatus.isPending);
  console.log("- isRegistered:", citizenStatus.isRegistered);
  console.log("- requestId:", citizenStatus.requestId.toString());
  console.log("- status:", citizenStatus.status.toString());
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
