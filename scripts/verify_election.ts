import { ethers, run } from "hardhat";

async function main() {
  const electionAddress = "0x06f3547872c584e2D677D0a556Ca23713d66aE85";
  console.log("Fetching constructor arguments for Election at:", electionAddress);

  // Get Election contract instance
  const Election = await ethers.getContractAt("Election", electionAddress);

  // Fetch properties
  const electionId = await Election.electionId();
  const name = await Election.electionName();
  const description = await Election.electionDescription();
  const startTime = await Election.startTime();
  const endTime = await Election.endTime();
  const voterRegistry = await Election.voterRegistry();
  const commission = await Election.commission();
  const voterPassContract = await Election.voterPassContract();
  const candidateCount = await Election.candidateCount();

  console.log("Election ID:", electionId.toString());
  console.log("Name:", name);
  console.log("Description:", description);
  console.log("Start Time:", startTime.toString());
  console.log("End Time:", endTime.toString());
  console.log("Voter Registry:", voterRegistry);
  console.log("Commission:", commission);
  console.log("Voter Pass Contract:", voterPassContract);
  console.log("Candidate Count:", candidateCount.toString());

  // Fetch candidates
  const candidateNames: string[] = [];
  const candidateParties: string[] = [];
  const candidateSymbols: string[] = [];

  for (let i = 0; i < Number(candidateCount); i++) {
    const candidate = await Election.candidates(i);
    candidateNames.push(candidate.name);
    candidateParties.push(candidate.party);
    candidateSymbols.push(candidate.symbol);
  }

  console.log("Candidate Names:", candidateNames);
  console.log("Candidate Parties:", candidateParties);
  console.log("Candidate Symbols:", candidateSymbols);

  const constructorArguments = [
    electionId,
    name,
    description,
    candidateNames,
    candidateParties,
    candidateSymbols,
    startTime,
    endTime,
    voterRegistry,
    commission,
    voterPassContract
  ];

  console.log("Verifying Election contract on Etherscan...");
  try {
    await run("verify:verify", {
      address: electionAddress,
      constructorArguments: constructorArguments,
    });
    console.log("Successfully verified Election contract!");
  } catch (error: any) {
    console.error("Verification failed:", error.message || error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
