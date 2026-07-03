import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  
  const officerAddress = "0x36e1C1EbC3e36d9b55E4b872A74B6F059008789e";
  console.log("Officer Target Wallet:", officerAddress);
  
  const registryAddress = "0xDe8B2D62C9c79bD9828A41dC305264D7fFBfEf5D";
  const voterPassAddress = "0x0e3b80dB7C5f1C9F43Ae1275302129b0c2B2151b";
  const factoryAddress = "0x7ef0Cbf328685674E4c14d9b9E349C797775993d";
  const identityRegistryAddress = "0x293657B337335D86a7e0c3DDF58dBB987fa39CBF";

  const registry = await ethers.getContractAt("VoterRegistry", registryAddress);
  const voterPass = await ethers.getContractAt("VoterEligibilityPass", voterPassAddress);
  const factory = await ethers.getContractAt("ElectionFactory", factoryAddress);
  const identityRegistry = await ethers.getContractAt("FHEIdentityRegistry", identityRegistryAddress);

  console.log("\n=== Checking VoterEligibilityPass ===");
  const ownerOfPass = await voterPass.owner();
  console.log("VoterEligibilityPass Owner:", ownerOfPass);
  const commissionInPass = await voterPass.commissionAddress();
  console.log("VoterEligibilityPass Commission Address:", commissionInPass);
  const factoryInPass = await voterPass.electionFactoryAddress();
  console.log("VoterEligibilityPass Election Factory Address:", factoryInPass);
  
  const isDeployerMinter = await voterPass.isAuthorizedMinter(deployer.address);
  const isRegistryMinter = await voterPass.isAuthorizedMinter(identityRegistryAddress);
  console.log("Is FHEIdentityRegistry authorized minter?", isRegistryMinter);
  console.log("Is Deployer authorized minter?", isDeployerMinter);

  const isDeployerSigner = await voterPass.isAuthorizedSigner(deployer.address);
  const isOfficerSigner = await voterPass.isAuthorizedSigner(officerAddress);
  console.log("Is Deployer (0x9dd4...) authorized signer?", isDeployerSigner);
  console.log("Is Officer (0x36e1...) authorized signer?", isOfficerSigner);

  console.log("\n=== Checking FHEIdentityRegistry ===");
  const ownerOfRegistry = await identityRegistry.owner();
  console.log("FHEIdentityRegistry Owner:", ownerOfRegistry);
  const commissionInRegistry = await identityRegistry.commission();
  console.log("FHEIdentityRegistry Commission:", commissionInRegistry);
  
  const isDeployerCommissioner = await identityRegistry.isCommissioner(deployer.address);
  const isOfficerCommissioner = await identityRegistry.isCommissioner(officerAddress);
  console.log("Is Deployer commissioner?", isDeployerCommissioner);
  console.log("Is Officer commissioner?", isOfficerCommissioner);

  const list = await identityRegistry.getCommissioners();
  console.log("Active Commissioners List:", list);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
