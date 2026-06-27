const fs = require('fs');
const path = require('path');

const abisSrcDir = path.join(__dirname, '../artifacts/contracts');
const abisDestDir = path.join(__dirname, '../frontend/src/abis');

if (!fs.existsSync(abisDestDir)) {
  fs.mkdirSync(abisDestDir, { recursive: true });
}

const files = [
  'VoterRegistry.sol/VoterRegistry.json',
  'ElectionFactory.sol/ElectionFactory.json',
  'Election.sol/Election.json',
  'FHEIdentityRegistry.sol/FHEIdentityRegistry.json'
];

files.forEach(f => {
  const src = path.join(abisSrcDir, f);
  const destName = path.basename(f);
  const dest = path.join(abisDestDir, destName);
  
  if (fs.existsSync(src)) {
    const data = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dest, data);
    console.log(`Copied ${destName} to frontend`);
  } else {
    console.warn(`Source not found: ${src}`);
  }
});
