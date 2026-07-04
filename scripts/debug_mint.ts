import { ethers } from "hardhat";

async function main() {
  const voter = "0x36e1C1EbC3e36d9b55E4b872A74B6F059008789e";
  console.log("Debugging minting for address:", voter);

  const registryAddress = "0xDe8B2D62C9c79bD9828A41dC305264D7fFBfEf5D";
  const voterPassAddress = "0x0e3b80dB7C5f1C9F43Ae1275302129b0c2B2151b";
  const identityRegistryAddress = "0x293657B337335D86a7e0c3DDF58dBB987fa39CBF";

  const registry = await ethers.getContractAt("VoterRegistry", registryAddress);
  const voterPass = await ethers.getContractAt("VoterEligibilityPass", voterPassAddress);
  const identityRegistry = await ethers.getContractAt("FHEIdentityRegistry", identityRegistryAddress);

  // 1. Get citizen status
  const status = await identityRegistry.getCitizenStatus(voter);
  console.log("\nCitizen Status:");
  console.log("- isVerified:", status.isVerified);
  console.log("- isPending:", status.isPending);
  console.log("- isRegistered:", status.isRegistered);
  console.log("- requestId:", status.requestId.toString());
  console.log("- status (enum):", status.status.toString());
  console.log("- rejectionReason:", status.rejectionReason);

  const requestId = Number(status.requestId);

  // 2. Fetch request info
  if (requestId > 0 || status.isVerified) {
    const req = await identityRegistry.requests(requestId);
    console.log("\nRequest Details from FHEIdentityRegistry:");
    console.log("- citizen:", req.citizen);
    console.log("- status:", req.status.toString());
    console.log("- commitmentHash:", req.commitmentHash);
    
    // Fetch signature
    const sig = await identityRegistry.approvedSignatures(requestId);
    console.log("- storedSignature:", sig);

    if (sig && sig !== "0x") {
      // Let's recover the signer off-chain
      // Try electionId = 0 (global)
      const msgHash0 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [voter, 0, req.commitmentHash]
      );
      const recovered0 = ethers.verifyMessage(ethers.getBytes(msgHash0), sig);
      console.log("\nRecovered Signer (electionId = 0):", recovered0);
      
      // Try electionId = 1
      const msgHash1 = ethers.solidityPackedKeccak256(
        ["address", "uint256", "bytes32"],
        [voter, 1, req.commitmentHash]
      );
      const recovered1 = ethers.verifyMessage(ethers.getBytes(msgHash1), sig);
      console.log("Recovered Signer (electionId = 1):", recovered1);

      // Check if recovered signer is authorized commissioner or officer
      const isRecovered0Signer = await voterPass.isAuthorizedSigner(recovered0);
      const isRecovered1Signer = await voterPass.isAuthorizedSigner(recovered1);
      console.log("- Is recovered signer (elecId=0) authorized in VEPass?", isRecovered0Signer);
      console.log("- Is recovered signer (elecId=1) authorized in VEPass?", isRecovered1Signer);

      const commissionAddress = await voterPass.commissionAddress();
      console.log("- commissionAddress in VEPass:", commissionAddress);
    } else {
      console.log("\nWARNING: No approved signature stored for this requestId.");
    }
  } else {
    console.log("\nNo request has been made or approved for this address yet.");
  }
  
  // Check if already minted
  const tokenForElection1 = await voterPass.walletTokens(voter, 1);
  console.log("\nVEPass Token for electionId=1:", tokenForElection1.toString());
  const tokenForElection0 = await voterPass.walletTokens(voter, 0);
  console.log("VEPass Token for electionId=0:", tokenForElection0.toString());
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
