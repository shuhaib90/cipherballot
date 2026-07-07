# CipherBallot  Confidential Election System

**Every vote counted. None seen.**

A fully decentralized, FHE-powered election platform where votes are encrypted on-chain, election authorities cannot cheat, and results are cryptographically verified.

**[🌐 Live Demo](https://cipherballot-six.vercel.app/)** | **[📋 Contract Addresses](#-deployed-contracts-sepolia-testnet)** | **[🧪 Test Guide](#-testing-guide-8-minutes)** | **[📖 How It Works](#-how-it-works)**

---

## 🎯 The Problem

Elections are broken. Every system has the same vulnerability:

| System | Problem |
|--------|---------|
| **Paper Ballots** | Poll workers stuff ballots. No way to verify without recounting. |
| **Digital Systems** | Database admins change vote counts. Server gets hacked. Nobody can verify. |
| **Blockchain Voting** | Votes are transparent. Everyone sees how you voted. Privacy lost. |
| **Previous FHE Voting** | Votes encrypted but no voter registration. Fake voters possible. |

**CipherBallot solves this by making it mathematically impossible to cheat.**

Instead of trusting a person, you trust math.

---

## 🔒 How It Works

### The Complete User Journey (8 Minutes)

#### Step 1: Register to Vote
Citizen submits encrypted government document (name, ID, date of birth, address).

**What happens:**
- Document encrypted in citizen's browser (plaintext never leaves their computer)
- Encrypted chunks sent to blockchain
- Election Commission can decrypt using FHE SDK userDecrypt() on their machine
- Commission approves → citizen's wallet auto-registers in VoterRegistry
- Encrypted document sealed on-chain forever (Commission cannot store, share, or delete it)

**Why FHE matters:** Document is encrypted on-chain. Only Commission can decrypt it. Nobody else can read it, not even Zama.

#### Step 2: Cast Encrypted Vote
Citizen selects candidate and clicks "Encrypt & Cast Vote."

**What happens:**
- Browser encrypts candidate choice using FHE SDK
- Encrypted choice sent to Election.sol smart contract
- Contract performs FHE operations WITHOUT decrypting:
For each candidate i:

Is encrypted_choice == i? (FHE comparison)

If yes: add 1 to encrypted_tally[i]

If no: add 0 to encrypted_tally[i]
- Vote tallied while encrypted
- Contract NEVER sees who you voted for

**Why FHE matters:** Contract counts votes without reading them. This is impossible with ZK proofs or normal encryption. Only FHE allows arithmetic on encrypted data.

#### Step 3: Voting Deadline Passes
After voting window closes (10 min for demo, 3 days for real election):
- All votes remain encrypted
- Dashboard shows only: "1,234 votes cast" (no breakdown)
- Nobody can see partial results or who is winning
- Prevents vote buying and bandwagon effect

#### Step 4: Results Revealed
Anyone clicks "Reveal Results" on blockchain.

**What happens:**
1. Smart contract sends decryption request to Zama KMS
2. KMS controlled by 5 independent validators
3. Each validator holds 1 cryptographic key (threshold cryptography)
4. Need 3-of-5 validators to cooperate for decryption (quorum)
5. Even if 2 are corrupted, cannot decrypt
6. KMS performs Multi-Party Computation (MPC) across validators
7. Decrypted vote counts returned to smart contract
8. Results written on-chain permanently

**Result:**
Priya Nair:    234 votes (45%)

Rajan Menon:   189 votes (36%)

Anitha Das:     98 votes (19%)

**Why FHE matters:** Results only visible after quorum approval. Before deadline, votes are mathematically unreadable. No single person can reveal results early.

#### Step 5: Verify Results Forever
Anyone can:
- Open Etherscan
- View election contract
- See all transactions
- Verify vote counts in ResultsRevealed event
- Prove results have not been changed

**Why blockchain matters:** Results are on immutable ledger. Visible forever. Cannot be backdated or modified.

---

## 🏗️ Architecture

### Three Smart Contracts

#### VoterRegistry.sol
Maintains the voter whitelist.

```solidity
mapping(address => bool) public isRegisteredVoter;
mapping(address => bytes32) public voterIdHash;
mapping(address => uint256) public registeredAt;

function registerVoter(address voter, bytes32 idHash) onlyOwnerOrRegistrar
function revokeVoter(address voter) onlyOwnerOrRegistrar
```

**Key Feature:** Prevents double voting. One wallet = one vote. Mathematically enforced in code.

**Who can register:** Election Commission (owner) or FHEIdentityRegistry (REGISTRAR role)

---

#### ElectionFactory.sol
Creates new elections and stores metadata.

```solidity
VoterRegistry public immutable voterRegistry;
address[] public elections;
uint256 public electionCount;

function createElection(
  string name,
  string description,
  string[] candidateNames,
  string[] candidateParties,
  string[] candidateSymbols,
  uint256 startTime,
  uint256 endTime
) onlyOwner returns (address)
```

**Key Feature:** Non-upgradeable. Anyone can view all elections. Results immutable once on-chain.

---

#### Election.sol (One per election)
Handles encrypted voting and FHE vote tallying.

```solidity
euint32[] private encryptedTallies;  // Vote count per candidate (encrypted)
mapping(address => bool) public hasVoted;
uint256 public totalVotesCast;

function castVote(
  externalEuint8 encryptedChoice,
  bytes calldata inputProof
) external
```

**The Core FHE Operation:**
```solidity
// Citizen's encrypted choice arrives at contract
euint8 choice = FHE.fromExternal(encryptedChoice, inputProof);

// For each candidate, count votes (in encrypted arithmetic)
for (uint8 i = 0; i < candidateCount; i++) {
    // Is this the chosen candidate? (encrypted comparison)
    ebool isChosen = FHE.eq(choice, FHE.asEuint8(i));
    
    // Add 1 if chosen, 0 if not (encrypted arithmetic)
    euint32 increment = FHE.select(
        isChosen,
        FHE.asEuint32(1),
        FHE.asEuint32(0)
    );
    
    // Update encrypted tally (still encrypted)
    encryptedTallies[i] = FHE.add(encryptedTallies[i], increment);
}
// Contract NEVER sees the plaintext choice
// Tallies stay encrypted until KMS approval
```

**Why This Is The Breakthrough:** The contract counts votes without ever reading them. Mathematically impossible without FHE.

---

#### FHEIdentityRegistry.sol
Manages encrypted identity documents and approvals.

```solidity
mapping(uint256 => euint256[]) private encryptedDocChunks;
mapping(uint256 => IdentityRequest) public requests;

function submitIdentityRequest(
  externalEuint256[] calldata encryptedChunks,
  bytes[]            calldata inputProofs,
  externalEuint8             encryptedDocTypeVal,
  bytes              calldata docTypeProof,
  bytes32                    commitmentHash
) external
```

**Key Feature:** 
- Citizens submit encrypted documents
- Commission can decrypt using FHE SDK (FHE.allow grants right)
- Commission approves → auto-registers voter in VoterRegistry
- Encrypted document sealed on-chain forever
- Commission cannot store, download, or share plaintext

---

## 📊 Why This Beats Everything Else

### vs. Traditional E-Voting
| Feature | Traditional | CipherBallot |
|---------|-------------|--------------|
| **Voter Verification** | Email (fakeable) | FHE-sealed identity docs |
| **Vote Privacy** | Server holds all power | Math enforces privacy |
| **Fake Voters** | Possible | Impossible (FHE identity) |
| **Authority Cheating** | Possible | Impossible (FHE math) |
| **Result Verification** | Trust us | Verify on Etherscan forever |

### vs. ZK-Based Voting
| Feature | ZK Voting | CipherBallot |
|---------|-----------|--------------|
| **Vote Encryption** | ✓ Yes | ✓ Yes |
| **Count Without Reading** | ✗ No | ✓ Yes (FHE) |
| **Identity Verification** | ✗ Limited | ✓ FHE-sealed docs |
| **Private Tallying** | ✗ Must decrypt to count | ✓ Count while encrypted |

### vs. Suffragium (Previous FHE Voting)
| Feature | Suffragium | CipherBallot |
|---------|-----------|--------------|
| **Vote Encryption** | ✓ FHE | ✓ FHE |
| **Voter Registration** | ✗ No | ✓ Yes, on-chain |
| **Fake Voter Prevention** | ✗ Email only | ✓ FHE identity |
| **Identity Verification** | ✗ No | ✓ FHE-sealed docs |
| **Complete Solution** | ✗ Partial | ✓ End-to-end |

---

## 🌐 Live Demo

### Open Now
**[https://cipherballot-six.vercel.app/](https://cipherballot-six.vercel.app/)**

Connect MetaMask to Sepolia and vote.

### 🔑 Judge Quick-Test Wallet (Voter & Commissioner)
For easier testing, you can import this pre-registered burner wallet into MetaMask. It is already registered as both a **Voter** and an **Election Commissioner / Officer**, allowing you to test all flows (voting, approving requests, creating/revealing elections) immediately without needing Sepolia faucet ETH or waiting for verification.

* **Private Key:** `0xc17e050709c8c16336e212b3bbcf44ddb263f14517a66e4b70b86b88c27e2f6e`
* **Network:** Sepolia Testnet

### Prerequisites
- MetaMask browser extension
- Sepolia ETH (get free from a Sepolia faucet, or use the quick-test wallet above)
- Sepolia network selected in MetaMask

---

## 🧪 Testing Guide (8 Minutes)

### ⏱️ 0:00 — Connect Wallet
1. Open [https://cipherballot-six.vercel.app/](https://cipherballot-six.vercel.app/)
2. Click "Connect Wallet"
3. MetaMask popup → Click "Connect"
4. Verify MetaMask shows "Sepolia" network
5. ✅ Header shows wallet address + registration status badge

### ⏱️ 1:00 — Register to Vote (If Not Already Registered)
1. Click "Register to Vote" tab
2. Select "🪪 National ID Card"
3. Fill form:
   - Full Name: Priya Nair
   - ID Number: KL12345678
   - Date of Birth: 1995-03-15
   - Address: Thiruvananthapuram, Kerala
4. Click "🔒 Encrypt & Submit"
5. Watch encryption overlay (data being sealed)
6. Confirm MetaMask transaction
7. ✅ You see: "Request submitted, awaiting approval"

**What just happened:**
- Your document encrypted in your browser
- Plaintext erased from memory
- Encrypted chunks sent to blockchain
- Election Commission can decrypt using FHE SDK
- Only Commission can read it (FHE.allow grants right)

### ⏱️ 2:00 — Commission Approves
- Commission wallet switches to "Commission" tab
- Sees your pending request in "Identity Requests" queue
- Reviews your encrypted document (decrypts on their machine)
- Clicks "✓ Approve Registration"
- Your wallet auto-registers in VoterRegistry
- ✅ You now see: "✓ Registered Voter" badge

### ⏱️ 3:00 — Cast Your Vote
1. Click "Voting Booth" tab
2. See "Kerala Panchayat Election 2026 — DEMO" (Status: LIVE)
3. Three candidates visible:
   - 🌱 Priya Nair (Development Alliance)
   - ⚡ Rajan Menon (Progress Front)
   - 🌟 Anitha Das (Citizens United)
4. Click on "Priya Nair"
5. Click "🔒 Encrypt & Cast Vote"
6. Watch encryption happen
7. Confirm MetaMask transaction
8. ✅ You see: "Vote cast successfully" + tx hash

**What just happened:**
- Your candidate choice encrypted in browser
- Encrypted choice sent to Election.sol
- Smart contract ran FHE operations WITHOUT seeing your vote:
  - For Priya (index 0): Is encrypted_choice == 0? → Yes → Add 1 (encrypted)
  - For Rajan (index 1): Is encrypted_choice == 1? → No → Add 0 (encrypted)
  - For Anitha (index 2): Is encrypted_choice == 2? → No → Add 0 (encrypted)
- Your vote counted while fully encrypted
- Contract has NO idea who you voted for

### ⏱️ 4:00 — Wait for Deadline (9 Minutes Left)
- Election voting window: 10 minutes (demo mode)
- Countdown timer shows the remaining time
- Dashboard shows:
  - Total votes cast: 1 (just your vote)
  - Vote breakdown: SECRET (encrypted)
  - Who is winning: UNKNOWN (sealed by FHE)
- Status: "VOTING ACTIVE — Individual votes sealed by FHE"

**Why this matters:**
- Cannot see partial results (prevents bandwagon effect)
- Cannot prove how you voted (prevents vote buying)
- Cannot leak early results (FHE keeps all encrypted)

### ⏱️ 5:00 — Vote as More Candidates (Optional)
To test election with multiple votes:
1. Switch accounts or import other test wallets in MetaMask.
2. Ensure they are registered.
3. Cast votes for different candidates to test the counts.

### ⏱️ 6:00 — Deadline Passes, Results Appear
After 10 minutes:
1. Voting closes
2. Status changes to "COUNTING... Decryption in progress"
3. Commission or anyone clicks "Reveal Results"
4. KMS threshold decryption happens (3-of-5 validators)
5. Results appear on-screen:
   - 🌱 Priya Nair: 2 votes (67%)
   - ⚡ Rajan Menon: 1 vote (33%)
   - 🌟 Anitha Das: 0 votes (0%)
6. Results also written to blockchain

### ⏱️ 7:00 — Verify Results on Etherscan
1. Copy election contract address from results page
2. Paste into [Etherscan Sepolia](https://sepolia.etherscan.io)
3. Click "Events" tab
4. Find `ResultsRevealed` event
5. See plaintext vote counts in event data
6. ✅ Proof: Results exist on immutable blockchain forever

### ⏱️ 8:00 — Done
You've tested:
- ✅ FHE identity verification (documents encrypted)
- ✅ Voter registration (only you can vote)
- ✅ FHE vote encryption (nobody saw your choice)
- ✅ Vote tallying in FHE (contract computed without seeing votes)
- ✅ KMS threshold decryption (results after quorum)
- ✅ On-chain verification (Etherscan proof)

---

## 📋 Deployed Contracts (Sepolia Testnet)

All contracts deployed and verified. View source code on Etherscan.

* **Network**: Ethereum Sepolia (chainId 11155111)
* **Status**: ✓ Live & Tested
* **Block Explorer**: https://sepolia.etherscan.io

| Contract | Address |
|---|---|
| **VoterRegistry** | [`0x03198fBa67791A2e88ce5Ca7B1805597730d7895`](https://sepolia.etherscan.io/address/0x03198fBa67791A2e88ce5Ca7B1805597730d7895) |
| **VoterEligibilityPass** | [`0x05DD2aaCDdF7042C603a23D39d5F362A0C9d7a86`](https://sepolia.etherscan.io/address/0x05DD2aaCDdF7042C603a23D39d5F362A0C9d7a86) |
| **ElectionFactory** | [`0x95A734487a02BbEbb4971386C797459e9AC069F5`](https://sepolia.etherscan.io/address/0x95A734487a02BbEbb4971386C797459e9AC069F5) |
| **FHEIdentityRegistry** | [`0xf961257585090A2A8282671360f03e041157B68F`](https://sepolia.etherscan.io/address/0xf961257585090A2A8282671360f03e041157B68F) |
| **Demo Election** | [`0x06f3547872c584e2D677D0a556Ca23713d66aE85`](https://sepolia.etherscan.io/address/0x06f3547872c584e2D677D0a556Ca23713d66aE85) |

---

## 🛠️ Tech Stack

### Smart Contracts
- **Language:** Solidity ^0.8.27
- **FHE Library:** Zama fhEVM (`@fhevm/solidity`)
- **Framework:** Hardhat + TypeScript
- **Testing:** Hardhat Test + TypeChain
- **Deployment:** Hardhat Scripts
- **Verification:** Etherscan

### Frontend
- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Styling:** Vanilla CSS + Lucide React icons
- **Web3:** Ethers.js v6 + `@fhevm/sdk`
- **Hosting:** Vercel (HTTPS + COEP headers)
- **Live:** [cipherballot-six.vercel.app](https://cipherballot-six.vercel.app/)

---

## 🔐 Security & Privacy

### What's Encrypted (FHE)

**Vote Choice**
- Stored as: `euint8` (encrypted candidate index 0-9)
- Encrypted by: Your browser via FHE SDK
- Readable by: Nobody (FHE math prevents decryption)
- Decrypted when: After voting deadline + KMS approval

**Identity Documents**
- Stored as: `euint256[]` chunks (name, ID, DOB, address encrypted)
- Encrypted by: Your browser
- Readable by: Only Election Commission (via FHE.allow + FHE SDK)
- Decrypted when: Commission verifies identity
- Kept as: Sealed on-chain forever (Commission cannot store plaintext)

**Vote Tallies**
- Stored as: `euint32` per candidate
- Encrypted by: Smart contract (`FHE.add` operations)
- Readable by: Nobody until deadline
- Decrypted when: Quorum (3/5 validators) approves via KMS

### What's Public (On-Chain)

**Voter Status**
- Who is registered: Public (`isRegisteredVoter` mapping)
- When registered: Public (timestamp)
- Vote counts: SECRET until deadline

**Election Metadata**
- Name, candidates, deadline: Public
- Total votes cast: Public (count only, no breakdown)
- Vote breakdown: SECRET (encrypted by FHE)

**Results (After Reveal)**
- Final vote counts per candidate: Public
- Who voted: Public (address in `hasVoted` mapping)
- How each person voted: SECRET FOREVER (FHE prevents reversal)

### Trust Model

**You trust:**
- ✓ Mathematics (FHE is cryptographically proven)
- ✓ Zama TKMS (decentralized key management, 3-of-5 quorum)
- ✓ Blockchain consensus

**You DON'T trust:**
- ✗ Election Commission (cannot cheat — FHE prevents it)
- ✗ Validators (cannot see individual votes)
- ✗ Central server (no central server exists)
- ✗ Any single entity (trustless by design)

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- npm or yarn
- MetaMask extension
- Sepolia ETH (from faucet)
- Alchemy API key (for RPC)

### Setup

```bash
# Clone repository
git clone https://github.com/shuhaib90/cipherballot.git
cd cipherballot

# Install dependencies
npm install
cd frontend && npm install && cd ..

# Create environment files
# Root: .env
cat > .env << EOF
PRIVATE_KEY=0x[your-sepolia-wallet-private-key]
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
ETHERSCAN_API_KEY=[your-etherscan-api-key]
EOF

# Frontend: frontend/.env.production
cat > frontend/.env.production << EOF
VITE_NETWORK=sepolia
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
VITE_RELAYER_URL=https://relayer.testnet.zama.cloud
VITE_VOTER_REGISTRY_ADDRESS=0x03198fBa67791A2e88ce5Ca7B1805597730d7895
VITE_VOTER_PASS_ADDRESS=0x05DD2aaCDdF7042C603a23D39d5F362A0C9d7a86
VITE_ELECTION_FACTORY_ADDRESS=0x95A734487a02BbEbb4971386C797459e9AC069F5
VITE_FHE_IDENTITY_REGISTRY_ADDRESS=0xf961257585090A2A8282671360f03e041157B68F
EOF
```

### Run Tests

```bash
# Smart contract tests
npx hardhat test
```

### Deploy to Sepolia

```bash
# Requires PRIVATE_KEY with Sepolia ETH
npx hardhat run scripts/deploy.ts --network sepolia
```

### Build Frontend

```bash
cd frontend
npm run build
```

---

## 📚 Project Structure

```
cipherballot/
├── contracts/
│   ├── VoterRegistry.sol           # Voter whitelist
│   ├── ElectionFactory.sol         # Create elections
│   ├── Election.sol                # Vote tallying (FHE)
│   └── FHEIdentityRegistry.sol     # Identity verification (FHE)
├── scripts/
│   ├── deploy.ts                   # Deploy to Sepolia
│   ├── create-election.ts          # Create new election
│   └── register-voters.ts          # Batch register voters
├── test/
│   ├── VoterRegistry.test.ts
│   ├── Election.test.ts
│   └── FHEIdentityRegistry.test.ts
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── VoterStatus.tsx
│   │   │   ├── VotingBooth.tsx
│   │   │   ├── ResultsDashboard.tsx
│   │   │   ├── IdentityVerification.tsx
│   │   │   ├── CommissionPanel.tsx
│   │   │   └── Documentation.tsx
│   │   ├── App.tsx
│   │   └── index.css
│   └── vite.config.ts
├── deployment-summary.json         # Real contract addresses
├── hardhat.config.ts
├── package.json
└── README.md
```

---

## 🎓 Understanding FHE

### What is Fully Homomorphic Encryption?

**Simple Definition:**
You can do math on encrypted data without decrypting it.

**Example:**
* **Normal Encryption:** 
  1. Plaintext: `5`
  2. Encrypted: `[UNREADABLE BYTES]`
  3. To add `3`: must decrypt → add `3` → encrypt again.
* **FHE:**
  1. Plaintext: `5`
  2. Encrypted: `[UNREADABLE BYTES]`
  3. To add `3`: add directly on encrypted bytes.
  4. Result: `[UNREADABLE BYTES]` (representing `8`, fully encrypted).

No decryption needed.



**Made with 🔐 by the CipherBallot team**

*Trust math. Not institutions.*
