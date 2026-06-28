import { useState } from 'react';
import { Share2, Download, Check, Copy, Link } from 'lucide-react';
import type { ElectionDetails } from '../hooks/useContract';

interface ElectionShareCardProps {
  election: ElectionDetails | null;
  electionAddress: string;
}

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
      // 1. Create off-screen canvas
      const canvas = document.createElement('canvas');
      canvas.width = 540;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // 2. Draw Sleek Dark Background
      const grad = ctx.createLinearGradient(0, 0, 0, 720);
      grad.addColorStop(0, '#0a0a0a');
      grad.addColorStop(1, '#161616');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 540, 720);

      // 3. Draw Zama Yellow Border Accent
      ctx.strokeStyle = '#FFD208';
      ctx.lineWidth = 6;
      ctx.strokeRect(15, 15, 510, 690);

      // 4. Draw Header
      ctx.fillStyle = '#FFD208';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CIPHERBALLOT', 270, 70);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('SECURE FHE-ENCRYPTED ELECTION', 270, 95);

      // Horizontal Divider
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, 120);
      ctx.lineTo(480, 120);
      ctx.stroke();

      // 5. Draw Election Details
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      
      // Wrap Title Text if too long
      const title = election.name || 'General Election';
      let y = 165;
      if (title.length > 25) {
        ctx.font = 'bold 22px sans-serif';
        const words = title.split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > 420 && n > 0) {
            ctx.fillText(line.trim(), 270, y);
            line = words[n] + ' ';
            y += 30;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line.trim(), 270, y);
      } else {
        ctx.fillText(title, 270, y);
      }

      // Draw active ballot status banner
      y += 45;
      ctx.fillStyle = '#FFD208';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('STATUS: VOTING IS ACTIVE', 270, y);

      // Draw secondary details line
      y += 25;
      ctx.fillStyle = '#64748b';
      ctx.font = '12px sans-serif';
      ctx.fillText('Powered by Zama FHEVM Cryptography', 270, y);

      // 6. Preload and Draw Candidate Images
      const candidates = election.candidates || [];
      const imageLoadPromises = candidates.map((c) => {
        return new Promise<HTMLImageElement | string>((resolve) => {
          const symbol = c.symbol;
          const isUrl = symbol.startsWith('http://') || symbol.startsWith('https://') || symbol.startsWith('/') || symbol.startsWith('data:image/');
          if (isUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // prevent tainted canvas
            img.onload = () => resolve(img);
            img.onerror = () => resolve(symbol); // fallback to text on error
            img.src = symbol;
          } else {
            resolve(symbol); // emoji text fallback
          }
        });
      });

      const loadedAssets = await Promise.all(imageLoadPromises);

      // Helper to draw a single candidate avatar & labels on the canvas
      const drawCandidate = (cx: CanvasRenderingContext2D, cand: any, asset: any, px: number, py: number) => {
        cx.save();
        // Draw Avatar Circle Background
        cx.fillStyle = '#1e293b';
        cx.strokeStyle = '#FFD208';
        cx.lineWidth = 3;
        cx.beginPath();
        cx.arc(px, py + 40, 36, 0, Math.PI * 2);
        cx.fill();
        cx.stroke();

        // Clip circular avatar if asset is preloaded image
        if (typeof asset !== 'string') {
          cx.beginPath();
          cx.arc(px, py + 40, 34, 0, Math.PI * 2);
          cx.clip();
          cx.drawImage(asset, px - 34, py + 6, 68, 68);
        } else {
          // Draw Emoji Symbol
          cx.fillStyle = '#ffffff';
          cx.font = '32px sans-serif';
          cx.textAlign = 'center';
          cx.textBaseline = 'middle';
          cx.fillText(asset, px, py + 40);
        }
        cx.restore();

        // Draw Candidate Name
        cx.fillStyle = '#f8fafc';
        cx.font = 'bold 13px sans-serif';
        cx.textAlign = 'center';
        cx.fillText(cand.name, px, py + 95);

        // Draw Candidate Party
        cx.fillStyle = '#94a3b8';
        cx.font = '10px sans-serif';
        cx.textAlign = 'center';
        cx.fillText(cand.party, px, py + 112);
      };

      // Draw Candidates
      y += 40;
      const count = candidates.length;
      if (count <= 2) {
        const startX = 270 - ((count - 1) * 80);
        for (let i = 0; i < count; i++) {
          const x = startX + (i * 160);
          drawCandidate(ctx, candidates[i], loadedAssets[i], x, y);
        }
        y += 130;
      } else {
        // Draw in 2 columns grid to fit 3+ candidates beautifully
        for (let i = 0; i < count; i++) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const x = col === 0 ? 170 : 370;
          const rowY = y + (row * 130);
          drawCandidate(ctx, candidates[i], loadedAssets[i], x, rowY);
        }
        y += (Math.ceil(count / 2) * 130) + 10;
      }

      // 7. Draw QR / Ballot Access Code Block
      y += 50;
      ctx.fillStyle = '#111827';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(100, y, 340, 100, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFD208';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCAN OR VISUALIZE TO VOTE', 270, y + 35);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      // Truncate address to fit nicely
      const displayAddress = electionAddress.substring(0, 12) + '...' + electionAddress.substring(electionAddress.length - 10);
      ctx.fillText(`BALLOT ADDR: ${displayAddress}`, 270, y + 60);

      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      ctx.fillText('Your ballot remains private, secure & fully verifiably private.', 270, y + 80);

      // 8. Download PNG
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-share-card.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate PNG share card:', err);
      alert('Could not generate share card. Check console for image loading issues.');
    } finally {
      setDownloading(false);
    }
  };

  const isImageUrl = (symbol: string) => {
    return symbol.startsWith('http://') || symbol.startsWith('https://') || symbol.startsWith('/') || symbol.startsWith('data:image/');
  };

  return (
    <div className="glass-panel p-6 relative overflow-hidden border-yellow-500/10">
      <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-yellow-500/5 blur-3xl"></div>
      
      <div className="space-y-5">
        <div>
          <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
            <Share2 className="h-4.5 w-4.5 text-[#FFD208]" />
            Share & Spread Ballot Card
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Spread the word for this cryptographic election. Generate a premium share card or copy the direct vote link.
          </p>
        </div>

        {/* Live Preview Share Card */}
        <div className="border border-slate-900 rounded-2xl bg-gradient-to-b from-slate-950 to-slate-900/60 p-5 space-y-5 shadow-2xl relative">
          <div className="absolute top-3 right-3 px-2 py-0.5 text-[8px] font-black bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded uppercase tracking-wider">
            Voting Active
          </div>

          <div className="text-center space-y-1.5 pt-2">
            <span className="text-[10px] font-black text-yellow-400 tracking-widest block uppercase">CipherBallot</span>
            <h4 className="text-md font-extrabold text-slate-100 leading-tight">{election.name}</h4>
            <p className="text-[10px] text-slate-400 line-clamp-2 max-w-sm mx-auto leading-relaxed">{election.description}</p>
          </div>

          {/* Candidates Row */}
          <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 py-2 max-w-sm mx-auto">
            {election.candidates.map((cand, idx) => (
              <div key={idx} className="flex flex-col items-center text-center space-y-1.5 w-[100px] shrink-0">
                <div className="h-12 w-12 rounded-full border border-yellow-500/20 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                  {isImageUrl(cand.symbol) ? (
                    <img src={cand.symbol} alt={cand.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xl">{cand.symbol}</span>
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-200 leading-none truncate w-full">{cand.name}</p>
                  <p className="text-[9px] text-slate-400 leading-normal mt-0.5 truncate w-full">{cand.party}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-950 border border-slate-900 p-3 rounded-xl flex items-center justify-between gap-3 font-mono text-[10px] text-slate-400">
            <span className="truncate flex-1">{shareUrl}</span>
            <button
              onClick={handleCopyLink}
              className="text-[#FFD208] hover:text-yellow-400 font-bold flex items-center gap-1 transition shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3.5">
          <button
            onClick={handleCopyLink}
            className="btn-secondary py-2.5 text-xs font-bold flex items-center justify-center gap-2 border border-slate-800 bg-[#0d0d0d] hover:bg-slate-900"
          >
            <Link className="h-3.5 w-3.5" />
            Copy Vote Link
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
