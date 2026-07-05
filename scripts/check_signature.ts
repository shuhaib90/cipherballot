import { ethers } from "hardhat";

async function main() {
  const registryAddr = "0xf961257585090A2A8282671360f03e041157B68F";
  const passAddr = "0x05DD2aaCDdF7042C603a23D39d5F362A0C9d7a86";
  
  const registry = await ethers.getContractAt("FHEIdentityRegistry", registryAddr);
  const pass = await ethers.getContractAt("VoterEligibilityPass", passAddr);
  
  const req = await registry.requests(0);
  const citizen = req.citizen;
  const commitmentHash = req.commitmentHash;
  
  const signature = await registry.approvedSignatures(0);
  console.log("Citizen:", citizen);
  console.log("Commitment Hash:", commitmentHash);
  console.log("Signature:", signature);

  const commissionAddress = await pass.commissionAddress();
  console.log("Pass Contract Commission Address:", commissionAddress);

  // Check if deployer is authorized signer
  const isDeployerAuthorized = await pass.isAuthorizedSigner("0x9dd428188e36D9446c0D7428c08fCD022574C034");
  console.log("Is Deployer (0x9dd4...) Authorized Signer?", isDeployerAuthorized);

  // Check if officer is authorized signer
  const isOfficerAuthorized = await pass.isAuthorizedSigner("0x36e1C1EbC3e36d9b55E4b872A74B6F059008789e");
  console.log("Is Officer (0x36e1...) Authorized Signer?", isOfficerAuthorized);

  // Recover signer for electionId = 0 (global)
  const msgHashGlobal = ethers.solidityPackedKeccak256(
    ["address", "uint256", "bytes32"],
    [citizen, 0, commitmentHash]
  );
  const recoveredSignerGlobal = ethers.verifyMessage(ethers.getBytes(msgHashGlobal), signature);
  console.log("Recovered Signer (electionId = 0):", recoveredSignerGlobal);

  // Recover signer for electionId = 1
  const msgHash1 = ethers.solidityPackedKeccak256(
    ["address", "uint256", "bytes32"],
    [citizen, 1, commitmentHash]
  );
  const recoveredSigner1 = ethers.verifyMessage(ethers.getBytes(msgHash1), signature);
  console.log("Recovered Signer (electionId = 1):", recoveredSigner1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
