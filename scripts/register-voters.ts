import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const registryAddress = process.env.VOTER_REGISTRY_ADDRESS;
  if (!registryAddress) {
    console.error("Please set VOTER_REGISTRY_ADDRESS in your .env file or environment");
    process.exit(1);
  }

  const voterAddressesStr = process.env.VOTER_ADDRESSES;
  if (!voterAddressesStr) {
    console.error("Please set VOTER_ADDRESSES (comma-separated) in your .env file or environment");
    process.exit(1);
  }

  const salt = process.env.VOTER_SALT || "VOTER_SALT";
  const voters = voterAddressesStr.split(",").map(addr => addr.trim()).filter(addr => ethers.isAddress(addr));

  if (voters.length === 0) {
    console.log("No valid voter addresses found.");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Starting batch registration of ${voters.length} voters...`);
  console.log(`Using VoterRegistry at: ${registryAddress}`);
  console.log(`Deployer address: ${deployer.address}`);

  const registry = await ethers.getContractAt("VoterRegistry", registryAddress);

  // Split into chunks of 50
  const chunkSize = 50;
  let totalRegistered = 0;

  for (let i = 0; i < voters.length; i += chunkSize) {
    const chunk = voters.slice(i, i + chunkSize);
    const hashes = chunk.map(addr =>
      ethers.solidityPackedKeccak256(["address", "string"], [addr, salt])
    );

    console.log(`Registering batch ${i / chunkSize + 1} (${chunk.length} voters)...`);
    const tx = await registry.registerVotersBatch(chunk, hashes);
    await tx.wait();
    totalRegistered += chunk.length;
    console.log(`Batch ${i / chunkSize + 1} confirmed.`);
  }

  console.log(`Successfully registered ${totalRegistered} voters.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
