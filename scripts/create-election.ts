import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const factoryAddress = process.env.ELECTION_FACTORY_ADDRESS;
  if (!factoryAddress) {
    console.error("Please set ELECTION_FACTORY_ADDRESS in your env or .env file");
    process.exit(1);
  }

  // CLI argument parsing
  const args = process.argv.slice(2);
  const getArg = (flag: string, defaultValue: string): string => {
    const index = args.indexOf(flag);
    if (index !== -1 && index + 1 < args.length) {
      return args[index + 1];
    }
    return defaultValue;
  };

  const name = getArg("--name", "Kerala Panchayat Election 2026");
  const description = getArg("--description", "Confidential Panchayat Election");
  const candidatesStr = getArg("--candidates", "Priya Nair,Rajan Menon,Anitha Das");
  const partiesStr = getArg("--parties", "Development Party,Progress Alliance,Citizens Front");
  const symbolsStr = getArg("--symbols", "🌱,⚡,🌟");
  const durationStr = getArg("--duration", "600"); // seconds

  const candidateNames = candidatesStr.split(",").map(c => c.trim());
  const candidateParties = partiesStr.split(",").map(p => p.trim());
  const candidateSymbols = symbolsStr.split(",").map(s => s.trim());
  const duration = parseInt(durationStr, 10);

  const [deployer] = await ethers.getSigners();
  console.log("====================================================");
  console.log("Creating New FHE Election...");
  console.log(`Factory: ${factoryAddress}`);
  console.log(`Name: ${name}`);
  console.log(`Candidates: ${candidateNames.join(", ")}`);
  console.log("====================================================");

  const factory = await ethers.getContractAt("ElectionFactory", factoryAddress);

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 10; // starts in 10s
  const endTime = startTime + duration;

  const tx = await factory.createElection(
    name,
    description,
    candidateNames,
    candidateParties,
    candidateSymbols,
    startTime,
    endTime
  );
  console.log("Sending transaction...");
  const receipt = await tx.wait();

  // Find deployed address from events
  const filter = factory.filters.ElectionDeployed;
  const events = await factory.queryFilter(filter, receipt?.blockNumber);
  const electionAddress = events[events.length - 1]?.args?.[1];

  console.log("Success!");
  console.log(`Election deployed at: ${electionAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
