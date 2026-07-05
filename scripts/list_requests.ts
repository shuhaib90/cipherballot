import { ethers } from "hardhat";

async function main() {
  const identityRegistryAddress = "0xf961257585090A2A8282671360f03e041157B68F";
  const identityRegistry = await ethers.getContractAt("FHEIdentityRegistry", identityRegistryAddress);

  const requestCount = await identityRegistry.requestCount();
  console.log("Request Count:", requestCount.toString());

  const allRequestsList = await identityRegistry.getAllRequests();
  console.log("All Requests length:", allRequestsList.length);
  for (let i = 0; i < allRequestsList.length; i++) {
    const r = allRequestsList[i];
    console.log(`Request #${i}:`);
    console.log("- citizen:", r.citizen);
    console.log("- status:", r.status.toString());
    console.log("- commitmentHash:", r.commitmentHash);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
