import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("====================================================");
  console.log("CipherBallot Deployment Script");
  console.log("Deployer Wallet:", deployer.address);
  console.log("Network:", network.name);
  console.log("====================================================");

  const officerAddress = process.env.ELECTION_OFFICER_ADDRESS || "0x36e1C1EbC3e36d9b55E4b872A74B6F059008789e";
  console.log(`Election Officer Target Wallet: ${officerAddress}`);

  // 1. Deploy VoterRegistry
  console.log("Deploying VoterRegistry...");
  const VoterRegistry = await ethers.getContractFactory("VoterRegistry");
  const registry = await VoterRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("VoterRegistry deployed to:", registryAddress);

  // 1.5 Deploy VoterEligibilityPass
  console.log("Deploying VoterEligibilityPass...");
  const VoterEligibilityPass = await ethers.getContractFactory("VoterEligibilityPass");
  const voterPass = await VoterEligibilityPass.deploy(officerAddress);
  await voterPass.waitForDeployment();
  const voterPassAddress = await voterPass.getAddress();
  console.log("VoterEligibilityPass deployed to:", voterPassAddress);

  // 2. Deploy ElectionFactory
  console.log("Deploying ElectionFactory...");
  const ElectionFactory = await ethers.getContractFactory("ElectionFactory");
  const factory = await ElectionFactory.deploy(registryAddress, voterPassAddress);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("ElectionFactory deployed to:", factoryAddress);

  // Deploy FHEIdentityRegistry
  console.log("Deploying FHEIdentityRegistry...");
  const FHEIdentityRegistry = await ethers.getContractFactory("FHEIdentityRegistry");
  const fheIdentityRegistry = await FHEIdentityRegistry.deploy(
    registryAddress,
    officerAddress,
    voterPassAddress
  );
  await fheIdentityRegistry.waitForDeployment();
  const identityRegistryAddress = await fheIdentityRegistry.getAddress();
  console.log("FHEIdentityRegistry deployed to:", identityRegistryAddress);

  // Configure VoterEligibilityPass
  console.log("Configuring VoterEligibilityPass authorization...");
  await (await voterPass.setElectionFactory(factoryAddress)).wait();
  await (await voterPass.setAuthorizedMinter(identityRegistryAddress, true)).wait();
  console.log("✅ VoterEligibilityPass permissions configured");

  // Grant FHEIdentityRegistry registrar role
  console.log("Granting FHEIdentityRegistry REGISTRAR role in VoterRegistry...");
  const addRegistrarTx = await registry.addRegistrar(identityRegistryAddress);
  await addRegistrarTx.wait();
  console.log("✅ FHEIdentityRegistry granted REGISTRAR role");

  // 3. Register deployer as first voter (for testing)
  console.log("Registering deployer as first voter...");
  const salt = "VOTER_SALT";
  const idHash = ethers.solidityPackedKeccak256(["address", "string"], [deployer.address, salt]);
  const tx = await registry.registerVoter(deployer.address, idHash);
  await tx.wait();
  console.log("Registered deployer successfully with voterIdHash:", idHash);

  // 4. Create demo election
  let electionAddress = ethers.ZeroAddress;
  
  if (network.name === "hardhat") {
    console.log("Skipping demo election deployment on in-process Hardhat network to avoid transient provider issues.");
  } else {
    console.log("Deploying Demo Election...");
    try {
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock ? latestBlock.timestamp : Math.floor(Date.now() / 1000);
      const startTime = now + 10; // starts in 10 seconds
      const endTime = now + 3600;  // ends in 1 hour

      const candidateNames = ["Priya Nair", "Rajan Menon", "Anitha Das"];
      const candidateParties = ["Development Party", "Progress Alliance", "Citizens Front"];
      const candidateSymbols = ["🌱", "⚡", "🌟"];

      const createTx = await factory.createElection(
        "Kerala Panchayat Election 2026 — Demo",
        "Demonstration of CipherBallot confidential voting system",
        candidateNames,
        candidateParties,
        candidateSymbols,
        startTime,
        endTime
      );
      await createTx.wait();

      const electionCount = await factory.electionCount();
      electionAddress = await factory.getElection(electionCount - 1n);
      console.log("Demo Election deployed to:", electionAddress);

      // Assert coprocessor initialized (required by hardhat-plugin in mock mode)
      try {
        const fhevm = require("hardhat").fhevm;
        if (fhevm && fhevm.assertCoprocessorInitialized) {
          console.log("Initializing mock coprocessor for Demo Election...");
          await fhevm.assertCoprocessorInitialized(electionAddress, "Election");
          console.log("Mock coprocessor initialized.");
        }
      } catch (e) {
        console.log("No mock coprocessor initialization needed.");
      }
    } catch (err: any) {
      console.warn("Failed to deploy demo election:", err.message || err);
      console.log("Continuing with VoterRegistry and ElectionFactory deployment.");
    }
  }

  // 4.5 Transfer ownership of VoterRegistry, ElectionFactory, FHEIdentityRegistry, and VoterEligibilityPass to the officer
  console.log("Transferring ownership of VoterRegistry, ElectionFactory, FHEIdentityRegistry, and VoterEligibilityPass to officer...");
  try {
    await (await registry.transferOwnership(officerAddress)).wait();
    await (await factory.transferOwnership(officerAddress)).wait();
    await (await fheIdentityRegistry.transferOwnership(officerAddress)).wait();
    await (await voterPass.transferOwnership(officerAddress)).wait();
    console.log("Ownership transferred successfully to:", officerAddress);
  } catch (err: any) {
    console.error("Failed to transfer ownership to officer:", err.message || err);
  }

  // 5. Write addresses + ABIs to frontend
  const frontendDir = path.join(__dirname, "../frontend/src");
  const abisDir = path.join(frontendDir, "abis");
  const utilsDir = path.join(frontendDir, "utils");

  if (!fs.existsSync(frontendDir)) fs.mkdirSync(frontendDir, { recursive: true });
  if (!fs.existsSync(abisDir)) fs.mkdirSync(abisDir, { recursive: true });
  if (!fs.existsSync(utilsDir)) fs.mkdirSync(utilsDir, { recursive: true });

  const registryArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/VoterRegistry.sol/VoterRegistry.json"), "utf8")
  );
  const factoryArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/ElectionFactory.sol/ElectionFactory.json"), "utf8")
  );
  const electionArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Election.sol/Election.json"), "utf8")
  );
  const identityRegistryArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/FHEIdentityRegistry.sol/FHEIdentityRegistry.json"), "utf8")
  );
  const voterPassArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/VoterEligibilityPass.sol/VoterEligibilityPass.json"), "utf8")
  );

  fs.writeFileSync(path.join(abisDir, "VoterRegistry.json"), JSON.stringify(registryArtifact, null, 2));
  fs.writeFileSync(path.join(abisDir, "ElectionFactory.json"), JSON.stringify(factoryArtifact, null, 2));
  fs.writeFileSync(path.join(abisDir, "Election.json"), JSON.stringify(electionArtifact, null, 2));
  fs.writeFileSync(path.join(abisDir, "FHEIdentityRegistry.json"), JSON.stringify(identityRegistryArtifact, null, 2));
  fs.writeFileSync(path.join(abisDir, "VoterEligibilityPass.json"), JSON.stringify(voterPassArtifact, null, 2));

  // Write contract.ts
  const contractTsContent = `// Deployed contract addresses and helper config
export const VOTER_REGISTRY_ADDRESS = "${registryAddress}";
export const ELECTION_FACTORY_ADDRESS = "${factoryAddress}";
export const FHE_IDENTITY_REGISTRY_ADDRESS = "${identityRegistryAddress}";
export const VOTER_PASS_ADDRESS = "${voterPassAddress}";
export const DEMO_ELECTION_ADDRESS = "${electionAddress}";

// KMS/FHEVM Addresses for Sepolia Testnet
export const ACL_CONTRACT_ADDRESS = "0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D";
export const KMS_CONTRACT_ADDRESS = "0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A"; 
export const INPUT_VERIFIER_CONTRACT_ADDRESS = "0xBBC1fFCdc7C316aAAd72E807D9b0272BE8F84DA0";
export const VERIFYING_CONTRACT_ADDRESS_DECRYPTION = "0x5D8BD78e2ea6bbE41f26dFe9fdaEAa349e077478";
export const VERIFYING_CONTRACT_ADDRESS_INPUT_VERIFICATION = "0x483b9dE06E4E4C7D35CCf5837A1668487406D955";
`;
  fs.writeFileSync(path.join(utilsDir, "contract.ts"), contractTsContent);
  console.log("Wrote ABIs and addresses to frontend");

  // 6. Write deployment summary
  const summary = {
    network: network.name,
    VoterRegistry: registryAddress,
    VoterEligibilityPass: voterPassAddress,
    ElectionFactory: factoryAddress,
    FHEIdentityRegistry: identityRegistryAddress,
    DemoElection: electionAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(path.join(__dirname, "../deployment-summary.json"), JSON.stringify(summary, null, 2));
  console.log("Deployment summary written successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
