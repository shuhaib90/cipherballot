import { useState } from 'react';
import { Share2, Download, Check, Link } from 'lucide-react';
import type { ElectionDetails } from '../hooks/useContract';

interface ElectionShareCardProps {
  election: ElectionDetails | null;
  electionAddress: string;
}

// 16x16 retro 8-bit shield sprite mapping for FHE privacy
const PIXEL_SHIELD = [
  "XXXXXXXXXXXXXXXX",
  "XXXXXXXXXXXXXXXX",
  "XX............XX",
  "XX...XXXXXX...XX",
  "XX..XXXXXXXX..XX",
  "XX..XX.XX.XX..XX",
  "XX..XXXXXXXX..XX",
  "XX...XXXXXX...XX",
  "XX....XXXX....XX",
  "XX.....XX.....XX",
  "XX............XX",
  "XXX..........XXX",
  ".XXX........XXX.",
  "..XXX......XXX..",
  "...XXXX..XXXX...",
  ".....XXXXXX....."
];

export function ElectionShareCard({ election, electionAddress }: ElectionShareCardProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!election || !electionAddress) return null;

  const shareUrl = `${window.location.origin}?election=${electionAddress}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleDownloadCard = async () => {
    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 540;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // 1. Draw Space starfield background
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, 540, 720);

      // Draw space depth gradient
      const bgGrad = ctx.createRadialGradient(270, 360, 50, 270, 360, 450);
      bgGrad.addColorStop(0, '#0e0e18');
      bgGrad.addColorStop(1, '#050508');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 540, 720);

      // Draw tiny random stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 120; i++) {
        const sx = (Math.sin(i * 9876) * 0.5 + 0.5) * 540;
        const sy = (Math.cos(i * 1234) * 0.5 + 0.5) * 720;
        const opacity = (Math.sin(i * 555) * 0.5 + 0.5) * 0.7 + 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Helper for rounded rectangles
      const drawRoundedRect = (
        c: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
      ) => {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r);
        c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h);
        c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
      };

      // 2. Draw Top Card (Metallic Badge)
      const metallicGrad = ctx.createLinearGradient(40, 50, 500, 230);
      metallicGrad.addColorStop(0, '#f1f5f9');
      metallicGrad.addColorStop(0.3, '#cbd5e1');
      metallicGrad.addColorStop(0.5, '#ffffff');
      metallicGrad.addColorStop(0.7, '#cbd5e1');
      metallicGrad.addColorStop(1, '#94a3b8');

      ctx.save();
      drawRoundedRect(ctx, 40, 50, 460, 160, 20);
      ctx.fillStyle = metallicGrad;
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Top notches (circular cuts)
      ctx.fillStyle = '#050508';
      // Left notch
      ctx.beginPath();
      ctx.arc(40, 130, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Right notch
      ctx.beginPath();
      ctx.arc(500, 130, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Top title text
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 38px monospace';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '6px';
      ctx.fillText('CIPHERBALLOT', 270, 134);

      // Trademark badge
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('®', 445, 115);

      // 3. Draw Bottom Card (Detailed Metallic Ticket)
      ctx.save();
      drawRoundedRect(ctx, 40, 235, 460, 435, 20);
      ctx.fillStyle = metallicGrad;
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Bottom notches
      ctx.fillStyle = '#050508';
      // Left notch
      ctx.beginPath();
      ctx.arc(40, 452, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Right notch
      ctx.beginPath();
      ctx.arc(500, 452, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Mascot black box
      ctx.fillStyle = '#090d16';
      drawRoundedRect(ctx, 65, 265, 140, 140, 14);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw 8-bit shield inside mascot box
      ctx.fillStyle = '#FFD208';
      const startX = 65 + (140 - (16 * 6)) / 2; // center 16x16 grid with cell size 6
      const startY = 265 + (140 - (16 * 6)) / 2;
      PIXEL_SHIELD.forEach((row, rIdx) => {
        row.split('').forEach((char, cIdx) => {
          if (char === 'X') {
            ctx.fillRect(startX + cIdx * 6, startY + rIdx * 6, 6, 6);
          }
        });
      });

      // Right metadata panel
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 20px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('CIPHERBALLOT', 225, 290);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('FHE SHIELDED VOTING PROTOCOL', 225, 308);

      // Underline header
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(225, 316);
      ctx.lineTo(470, 316);
      ctx.stroke();

      // Draw metadata rows
      const drawMetaRow = (label: string, value: string, ry: number) => {
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(label, 225, ry);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(value, 225, ry + 16);

        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(225, ry + 25);
        ctx.lineTo(470, ry + 25);
        ctx.stroke();
      };

      drawMetaRow('POLL NAME:', election.name.substring(0, 20), 340);
      drawMetaRow('TALLY STATUS:', 'FHE SEALED', 380);

      // Circular ticket badge number on the bottom right
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(435, 342, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`#${String(election.electionId).padStart(2, '0')}`, 435, 347);

      // Remaining metadata rows
      ctx.textAlign = 'left';
      drawMetaRow('TOTAL BALLOTS CAST:', `${election.totalVotesCast} Whitelisted`, 435);
      drawMetaRow('VERIFICATION NETWORK:', 'SEPOLIA TESTNET', 475);
      drawMetaRow('BALLOT ADDRESS:', electionAddress.substring(0, 24) + '...', 515);

      // Bottom banner block
      ctx.fillStyle = '#0f172a';
      drawRoundedRect(ctx, 65, 575, 410, 50, 10);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('We compute on encrypted ballots without decryptions!', 270, 605);

      // 4. Download PNG
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${election.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-shield-card.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate PNG share card:', err);
      alert('Could not generate share card.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="glass-panel p-6 relative overflow-hidden border-yellow-500/10">
      <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-yellow-500/5 blur-3xl"></div>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
            <Share2 className="h-4.5 w-4.5 text-[#FFD208]" />
            Generate Share Card
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Spread the word on X (Twitter) or Instagram. Export a premium pixel-styled metal ticket of your ballot focus.
          </p>
        </div>

        {/* Live Preview Share Card (Styled exactly like the Zesty Saloon Ticket mockup) */}
        <div className="flex flex-col items-center py-6 px-4 bg-slate-950/80 rounded-3xl border border-slate-900 shadow-2xl relative overflow-hidden space-y-4">
          
          {/* Subtle starry background decoration */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          {/* Top Metallic Ticket */}
          <div className="w-full max-w-[340px] bg-gradient-to-br from-slate-200 via-slate-50 to-slate-300 border-2 border-slate-400 rounded-2xl p-4 flex flex-col items-center relative shadow-xl">
            
            {/* Notch Cutouts */}
            <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-[#050508] border-r-2 border-slate-400"></div>
            <div className="absolute top-1/2 -right-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-[#050508] border-l-2 border-slate-400"></div>
            
            <h4 className="font-mono text-slate-900 text-lg font-black tracking-[4px] uppercase select-none flex items-center gap-1">
              CipherBallot <span className="text-[10px] font-bold align-super">®</span>
            </h4>
          </div>

          {/* Bottom Metallic Ticket */}
          <div className="w-full max-w-[340px] bg-gradient-to-br from-slate-200 via-slate-50 to-slate-300 border-2 border-slate-400 rounded-2xl p-5 flex flex-col relative shadow-xl space-y-4 text-slate-900">
            
            {/* Notch Cutouts */}
            <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-[#050508] border-r-2 border-slate-400"></div>
            <div className="absolute top-1/2 -right-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-[#050508] border-l-2 border-slate-400"></div>

            {/* Top row: Mascot & Header details */}
            <div className="flex gap-4 items-center">
              {/* Retro Mascot Container */}
              <div className="h-[96px] w-[96px] bg-[#090d16] border border-slate-800 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                {/* 8-bit shield rendered inside pure SVG */}
                <svg viewBox="0 0 16 16" className="w-16 h-16 text-[#FFD208] fill-current">
                  {PIXEL_SHIELD.map((row, rIdx) =>
                    row.split('').map((char, cIdx) =>
                      char === 'X' ? (
                        <rect key={`${rIdx}-${cIdx}`} x={cIdx} y={rIdx} width="1" height="1" />
                      ) : null
                    )
                  )}
                </svg>
              </div>

              {/* Main Metadata Panel */}
              <div className="flex-1 space-y-1 overflow-hidden relative">
                <div className="flex justify-between items-start">
                  <h5 className="font-mono text-slate-900 font-extrabold text-sm tracking-wider uppercase truncate max-w-[120px]">
                    CipherBallot
                  </h5>
                  {/* Circular ID Badge */}
                  <div className="h-9 w-9 bg-slate-900 rounded-full flex items-center justify-center text-white font-mono text-xs font-bold shrink-0 shadow">
                    #{String(election.electionId).padStart(2, '0')}
                  </div>
                </div>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-wide">
                  FHE SHIELDED VOTING PROTOCOL
                </p>
                <div className="border-b border-slate-400 pt-1"></div>

                <div className="pt-1.5 space-y-0.5">
                  <span className="text-[7.5px] font-bold text-slate-500 block">POLL NAME:</span>
                  <span className="text-[10px] font-bold font-mono block text-slate-900 truncate leading-tight">
                    {election.name}
                  </span>
                </div>
              </div>
            </div>

            {/* List details */}
            <div className="space-y-2 text-[10px] font-mono border-t border-b border-slate-350 py-3">
              <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                <span className="text-slate-500 font-semibold">TALLY STATUS:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  FHE SEALED
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                <span className="text-slate-500 font-semibold">TOTAL BALLOTS:</span>
                <span className="font-bold text-slate-900">{election.totalVotesCast} Cast</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                <span className="text-slate-500 font-semibold">VERIFICATION NET:</span>
                <span className="font-bold text-slate-900">SEPOLIA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">BALLOT ADDR:</span>
                <span className="font-bold text-slate-900 truncate max-w-[120px] select-all">
                  {electionAddress.substring(0, 8)}...{electionAddress.substring(electionAddress.length - 6)}
                </span>
              </div>
            </div>

            {/* Bottom Banner */}
            <div className="w-full bg-slate-900 text-white py-2 rounded-lg text-center text-[9px] font-bold tracking-wide uppercase select-none shadow">
              Encrypted & Verifiable with FHE!
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3.5">
          <button
            onClick={handleCopyLink}
            className="btn-secondary py-2.5 text-xs font-bold flex items-center justify-center gap-2 border border-slate-800 bg-[#0d0d0d] hover:bg-slate-900"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Link className="h-3.5 w-3.5" />}
            {copied ? 'Copied Link!' : 'Copy Vote Link'}
          </button>
          <button
            onClick={handleDownloadCard}
            disabled={downloading}
            className="btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2"
          >
            {downloading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Download PNG Card
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Add a dummy refresh animation helper
function RefreshCw(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}
