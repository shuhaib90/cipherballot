import { useState } from 'react';
import { Share2, Download, Check, Link } from 'lucide-react';
import type { ElectionDetails } from '../hooks/useContract';

interface ElectionShareCardProps {
  election: ElectionDetails | null;
  electionAddress: string;
}

// 16x16 FHE shield pixel-art sprite mapping
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
  const [ratio, setRatio] = useState<'x_post' | 'insta_story'>('x_post');

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

  const isImageUrl = (symbol: string) => {
    return symbol.startsWith('http://') || symbol.startsWith('https://') || symbol.startsWith('/') || symbol.startsWith('data:image/');
  };

  const handleDownloadCard = async () => {
    setDownloading(true);
    try {
      const isStory = ratio === 'insta_story';
      const canvas = document.createElement('canvas');
      
      // Set high-res dimensions
      // X Post: 1080x1080 (Square)
      // Insta Story: 1080x1920 (9:16 vertical)
      canvas.width = 1080;
      canvas.height = isStory ? 1920 : 1080;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // 1. Draw space-themed starfield background
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const radialX = canvas.width / 2;
      const radialY = canvas.height / 2;
      const radialR = Math.max(canvas.width, canvas.height) / 2;
      const bgGrad = ctx.createRadialGradient(radialX, radialY, 100, radialX, radialY, radialR);
      bgGrad.addColorStop(0, '#0e0e18');
      bgGrad.addColorStop(1, '#050508');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw random space stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < (isStory ? 200 : 120); i++) {
        const sx = (Math.sin(i * 4567) * 0.5 + 0.5) * canvas.width;
        const sy = (Math.cos(i * 7654) * 0.5 + 0.5) * canvas.height;
        const opacity = (Math.sin(i * 123) * 0.5 + 0.5) * 0.7 + 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.fillRect(sx, sy, 2, 2);
      }

      // Helper to draw rounded rectangle shapes
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

      // Load all candidate images
      const candidates = election.candidates || [];
      const imageLoadPromises = candidates.map((c) => {
        return new Promise<HTMLImageElement | string>((resolve) => {
          const symbol = c.symbol;
          if (isImageUrl(symbol)) {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // prevent tainted canvas
            img.onload = () => resolve(img);
            img.onerror = () => resolve(symbol);
            img.src = symbol;
          } else {
            resolve(symbol); // emoji / text fallback
          }
        });
      });

      const loadedAssets = await Promise.all(imageLoadPromises);

      // Card gradient: Premium chrome/silver
      const getCardGrad = (x: number, y: number, w: number, h: number) => {
        const g = ctx.createLinearGradient(x, y, x + w, y + h);
        g.addColorStop(0, '#f8fafc');
        g.addColorStop(0.2, '#cbd5e1');
        g.addColorStop(0.5, '#ffffff');
        g.addColorStop(0.8, '#cbd5e1');
        g.addColorStop(1, '#94a3b8');
        return g;
      };

      // Draw a candidate avatar & text details
      const drawCanvasCandidate = (
        c: CanvasRenderingContext2D,
        cand: any,
        asset: any,
        cx: number,
        cy: number,
        size: number = 90
      ) => {
        c.save();
        // Outer avatar ring
        c.fillStyle = '#0f172a';
        c.strokeStyle = '#475569';
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(cx, cy + size / 2, size / 2, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Clip image
        if (typeof asset !== 'string') {
          c.beginPath();
          c.arc(cx, cy + size / 2, size / 2 - 2, 0, Math.PI * 2);
          c.clip();
          c.drawImage(asset, cx - size / 2, cy, size, size);
        } else {
          // Emoji fallback
          c.fillStyle = '#ffffff';
          c.font = `bold ${Math.floor(size * 0.45)}px sans-serif`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(asset, cx, cy + size / 2);
        }
        c.restore();

        // Candidate Name
        c.fillStyle = '#0f172a';
        c.font = 'bold 15px sans-serif';
        c.textAlign = 'center';
        c.fillText(cand.name, cx, cy + size + 25);

        // Candidate Party
        c.fillStyle = '#475569';
        c.font = 'bold 11px sans-serif';
        c.fillText(cand.party.toUpperCase(), cx, cy + size + 42);
      };

      // Layout coordinates based on aspect ratio
      if (!isStory) {
        // ==========================================
        // SQUARE FORMAT (X POST: 1080x1080)
        // ==========================================
        
        // 1. Top Header Ticket Card
        const topW = 960;
        const topH = 150;
        const topX = 60;
        const topY = 60;
        
        ctx.save();
        drawRoundedRect(ctx, topX, topY, topW, topH, 24);
        ctx.fillStyle = getCardGrad(topX, topY, topW, topH);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Notch cutouts
        ctx.fillStyle = '#050508';
        ctx.beginPath();
        ctx.arc(topX, topY + topH / 2, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(topX + topW, topY + topH / 2, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Brand Name Text
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 38px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '8px';
        ctx.fillText('CIPHERBALLOT®', 540, topY + 92);

        // 2. Bottom Content Ticket Card
        const botW = 960;
        const botH = 750;
        const botX = 60;
        const botY = 270;

        ctx.save();
        drawRoundedRect(ctx, botX, botY, botW, botH, 24);
        ctx.fillStyle = getCardGrad(botX, botY, botW, botH);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Notches
        ctx.fillStyle = '#050508';
        ctx.beginPath();
        ctx.arc(botX, botY + botH / 2, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(botX + botW, botY + botH / 2, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Poll Name & Description
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 28px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(election.name.toUpperCase(), 540, botY + 60);

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 14px sans-serif';
        const truncatedDesc = election.description.length > 90 
          ? election.description.substring(0, 90) + '...' 
          : election.description;
        ctx.fillText(truncatedDesc, 540, botY + 90);

        // Dash Line Separator
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(100, botY + 120);
        ctx.lineTo(980, botY + 120);
        ctx.stroke();
        ctx.setLineDash([]);

        // Candidates Row (Horizontal layout)
        const candY = botY + 155;
        const candCount = candidates.length;
        // Limit rendering up to 4 candidates in horizontal row to fit cleanly
        const renderCount = Math.min(candCount, 4);
        const startX = 540 - ((renderCount - 1) * 115);
        for (let i = 0; i < renderCount; i++) {
          const cx = startX + (i * 230);
          drawCanvasCandidate(ctx, candidates[i], loadedAssets[i], cx, candY, 96);
        }

        // Horizontal line separator
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(100, botY + 340);
        ctx.lineTo(980, botY + 340);
        ctx.stroke();

        // Left Side: 8-Bit Mascot Badge
        const mascotW = 160;
        const mascotH = 160;
        const mascotX = 120;
        const mascotY = botY + 375;

        ctx.fillStyle = '#090d16';
        drawRoundedRect(ctx, mascotX, mascotY, mascotW, mascotH, 16);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw pixel shield in yellow
        ctx.fillStyle = '#FFD208';
        const startPixelX = mascotX + (mascotW - (16 * 7)) / 2;
        const startPixelY = mascotY + (mascotH - (16 * 7)) / 2;
        PIXEL_SHIELD.forEach((row, rIdx) => {
          row.split('').forEach((char, cIdx) => {
            if (char === 'X') {
              ctx.fillRect(startPixelX + cIdx * 7, startPixelY + rIdx * 7, 7, 7);
            }
          });
        });

        // Right Side: Passport Metadata
        ctx.textAlign = 'left';
        const metaX = 320;
        const metaY = botY + 395;

        const drawSquareMeta = (lbl: string, val: string, ox: number, oy: number) => {
          ctx.fillStyle = '#475569';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(`[${lbl.toUpperCase()}]`, ox, oy);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 14px Courier New, monospace';
          ctx.fillText(val, ox, oy + 20);
        };

        drawSquareMeta('tally status', 'FHE SEALED', metaX, metaY);
        drawSquareMeta('total ballots', `${election.totalVotesCast} Cast`, metaX, metaY + 52);
        drawSquareMeta('ballot contract', electionAddress.substring(0, 16) + '...', metaX, metaY + 104);

        drawSquareMeta('network', 'SEPOLIA', metaX + 280, metaY);
        drawSquareMeta('quorum key', 'KMS THRESHOLD', metaX + 280, metaY + 52);
        drawSquareMeta('poll code', `#${String(election.electionId).padStart(4, '0')}`, metaX + 280, metaY + 104);

        // 3. Bottom Banner
        ctx.fillStyle = '#0f172a';
        drawRoundedRect(ctx, 120, botY + 580, 800, 60, 14);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 15px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '1px';
        ctx.fillText('ENCRYPTED & VERIFIABLE WITH FULLY HOMOMORPHIC ENCRYPTION', 540, botY + 616);

        // Circular number badge top-right of bottom card
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(940, botY + 60, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`#${String(election.electionId).padStart(2, '0')}`, 940, botY + 66);

      } else {
        // ==========================================
        // VERTICAL STORY FORMAT (INSTAGRAM STORY: 1080x1920)
        // ==========================================
        
        // 1. Top Ticket Card
        const topW = 960;
        const topH = 200;
        const topX = 60;
        const topY = 120;

        ctx.save();
        drawRoundedRect(ctx, topX, topY, topW, topH, 24);
        ctx.fillStyle = getCardGrad(topX, topY, topW, topH);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Notches
        ctx.fillStyle = '#050508';
        ctx.beginPath();
        ctx.arc(topX, topY + topH / 2, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(topX + topW, topY + topH / 2, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Header Title
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 46px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '10px';
        ctx.fillText('CIPHERBALLOT®', 540, topY + 120);

        // 2. Bottom Ticket Card (Tall)
        const botW = 960;
        const botH = 1420;
        const botX = 60;
        const botY = 380;

        ctx.save();
        drawRoundedRect(ctx, botX, botY, botW, botH, 24);
        ctx.fillStyle = getCardGrad(botX, botY, botW, botH);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Notches at multiple heights for vertical ticket style
        ctx.fillStyle = '#050508';
        ctx.beginPath();
        ctx.arc(botX, botY + 400, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(botX + botW, botY + 400, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(botX, botY + 950, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(botX + botW, botY + 950, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Poll Name & Description
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 36px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(election.name.toUpperCase(), 540, botY + 80);

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(election.description, 540, botY + 120);

        // Dashed Separator
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(100, botY + 160);
        ctx.lineTo(980, botY + 160);
        ctx.stroke();
        ctx.setLineDash([]);

        // Candidates Section (Clean 2x2 grid or row depending on quantity)
        const candY = botY + 200;
        ctx.fillStyle = '#334155';
        ctx.font = '900 13px Outfit, sans-serif';
        ctx.letterSpacing = '2px';
        ctx.textAlign = 'center';
        ctx.fillText('SHIELDED CANDIDATES LIST', 540, candY);

        const gridY = botY + 260;
        const renderCount = Math.min(candidates.length, 6);
        
        // Render up to 6 candidates in a grid
        for (let i = 0; i < renderCount; i++) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const cx = col === 0 ? 320 : 760;
          const cy = gridY + (row * 180);
          drawCanvasCandidate(ctx, candidates[i], loadedAssets[i], cx, cy, 100);
        }

        // Horizontal Separator
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(100, botY + 800);
        ctx.lineTo(980, botY + 800);
        ctx.stroke();

        // 8-Bit Mascot Box (Left side of bottom section)
        const mascotW = 180;
        const mascotH = 180;
        const mascotX = 120;
        const mascotY = botY + 840;

        ctx.fillStyle = '#090d16';
        drawRoundedRect(ctx, mascotX, mascotY, mascotW, mascotH, 20);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw pixel shield in yellow
        ctx.fillStyle = '#FFD208';
        const startPixelX = mascotX + (mascotW - (16 * 8)) / 2;
        const startPixelY = mascotY + (mascotH - (16 * 8)) / 2;
        PIXEL_SHIELD.forEach((row, rIdx) => {
          row.split('').forEach((char, cIdx) => {
            if (char === 'X') {
              ctx.fillRect(startPixelX + cIdx * 8, startPixelY + rIdx * 8, 8, 8);
            }
          });
        });

        // Passport Metadata Table (Right side of bottom section)
        ctx.textAlign = 'left';
        const metaX = 350;
        const metaY = botY + 860;

        const drawStoryMeta = (lbl: string, val: string, ox: number, oy: number) => {
          ctx.fillStyle = '#475569';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`[${lbl.toUpperCase()}]`, ox, oy);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 15px Courier New, monospace';
          ctx.fillText(val, ox, oy + 22);
        };

        drawStoryMeta('tally status', 'FHE SEALED', metaX, metaY);
        drawStoryMeta('total ballots', `${election.totalVotesCast} Cast`, metaX, metaY + 60);
        drawStoryMeta('ballot contract', electionAddress.substring(0, 20) + '...', metaX, metaY + 120);

        drawStoryMeta('network', 'SEPOLIA', metaX + 280, metaY);
        drawStoryMeta('quorum key', 'KMS THRESHOLD', metaX + 280, metaY + 60);
        drawStoryMeta('poll code', `#${String(election.electionId).padStart(4, '0')}`, metaX + 280, metaY + 120);

        // Dashed Line Separator
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(100, botY + 1090);
        ctx.lineTo(980, botY + 1090);
        ctx.stroke();
        ctx.setLineDash([]);

        // Barcode strip
        ctx.fillStyle = '#0f172a';
        let barcodeX = 120;
        const barcodeY = botY + 1130;
        const barcodeHeight = 55;
        const pattern = [4, 6, 2, 4, 3, 2, 5, 3, 4, 2, 4, 6, 2, 4, 3, 2, 5, 3, 2, 4, 3, 6, 2, 4];
        pattern.forEach((width) => {
          ctx.fillRect(barcodeX, barcodeY, width, barcodeHeight);
          barcodeX += width + 4;
        });

        // Bottom right: Digital signature
        ctx.textAlign = 'right';
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('[network signature]', 960, botY + 1120);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'italic bold 22px monospace';
        ctx.fillText('~ Network Guardians ~', 960, botY + 1152);

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('Issued: Block #5,291,402  |  Expires: Block #15,291,402', 960, botY + 1175);

        // Bottom Banner text block
        ctx.fillStyle = '#0f172a';
        drawRoundedRect(ctx, 120, botY + 1240, 820, 70, 16);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 17px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '1px';
        ctx.fillText('CIPHERBALLOT: VERIFIABLE DECENTRALIZED VOTING POWERED BY FHE', 530, botY + 1282);

        // Circular number badge top-right
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(940, botY + 80, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`#${String(election.electionId).padStart(2, '0')}`, 940, botY + 86);
      }

      // 4. Download PNG
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const ratioName = isStory ? 'instagram-story' : 'x-post';
      link.download = `${election.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${ratioName}.png`;
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-md font-bold text-slate-100 flex items-center gap-2">
              <Share2 className="h-4.5 w-4.5 text-[#FFD208]" />
              Generate Share Card
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Export a premium pixel-styled metal ticket of your ballot focus.
            </p>
          </div>

          {/* Aspect Ratio Toggle Tabs */}
          <div className="flex bg-slate-950 p-1 border border-slate-900 rounded-full select-none shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setRatio('x_post')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition ${
                ratio === 'x_post'
                  ? 'bg-yellow-500 text-black shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              X Post (1:1)
            </button>
            <button
              onClick={() => setRatio('insta_story')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition ${
                ratio === 'insta_story'
                  ? 'bg-yellow-500 text-black shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Insta Story (9:16)
            </button>
          </div>
        </div>

        {/* Live Preview Share Card (Styled exactly like the Zesty Saloon Ticket mockup) */}
        <div className="flex flex-col items-center py-6 px-4 bg-[#050508]/90 rounded-3xl border border-slate-900 shadow-2xl relative overflow-hidden space-y-4">
          
          {/* Starfield backdrop effect */}
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
          
          {/* Dynamic layout container wrapper */}
          <div className={`w-full flex flex-col items-center transition-all duration-300 ${
            ratio === 'insta_story' ? 'max-w-[280px] space-y-3.5' : 'max-w-[340px] space-y-4'
          }`}>
            
            {/* Top Metallic Ticket */}
            <div className="w-full bg-gradient-to-br from-slate-200 via-slate-50 to-slate-300 border-2 border-slate-400 rounded-2xl p-4 flex flex-col items-center relative shadow-xl shrink-0">
              
              {/* Notch Cutouts */}
              <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-[#050508] border-r-2 border-slate-400"></div>
              <div className="absolute top-1/2 -right-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-[#050508] border-l-2 border-slate-400"></div>
              
              <h4 className="font-mono text-slate-900 text-base font-black tracking-[4px] uppercase select-none flex items-center gap-1">
                CipherBallot <span className="text-[9px] font-bold align-super">®</span>
              </h4>
            </div>

            {/* Bottom Metallic Ticket (Varies in height depending on ratio selection) */}
            <div className={`w-full bg-gradient-to-br from-slate-200 via-slate-50 to-slate-300 border-2 border-slate-400 rounded-2xl p-4 flex flex-col relative shadow-xl text-slate-900 overflow-hidden transition-all duration-300 ${
              ratio === 'insta_story' ? 'h-[430px] justify-between' : 'space-y-4'
            }`}>
              
              {/* Notch Cutouts Middle */}
              <div className="absolute top-[180px] -left-3.5 w-7 h-7 rounded-full bg-[#050508] border-r-2 border-slate-400"></div>
              <div className="absolute top-[180px] -right-3.5 w-7 h-7 rounded-full bg-[#050508] border-l-2 border-slate-400"></div>

              {/* Notch Cutouts Bottom */}
              <div className="absolute bottom-[80px] -left-3.5 w-7 h-7 rounded-full bg-[#050508] border-r-2 border-slate-400"></div>
              <div className="absolute bottom-[80px] -right-3.5 w-7 h-7 rounded-full bg-[#050508] border-l-2 border-slate-400"></div>

              {/* Title Header */}
              <div className="text-center relative">
                <h5 className="font-sans text-slate-900 font-extrabold text-sm tracking-wide uppercase truncate leading-tight pr-6">
                  {election.name}
                </h5>
                <p className="text-[8px] text-slate-500 font-semibold line-clamp-1 mt-0.5 max-w-[90%] mx-auto">
                  {election.description}
                </p>

                {/* Circular ID Badge */}
                <div className="absolute -top-1.5 -right-1.5 h-7 w-7 bg-slate-900 rounded-full flex items-center justify-center text-white font-mono text-[9px] font-bold shrink-0 shadow">
                  #{String(election.electionId).padStart(2, '0')}
                </div>
              </div>

              {/* Divider */}
              <div className="border-b border-dashed border-slate-350 w-full pt-1.5"></div>

              {/* Candidates row (Displays avatars & names) */}
              <div className="space-y-2">
                <span className="text-[7.5px] font-black text-slate-500 tracking-wider block text-center uppercase">
                  Shielded Candidates List
                </span>
                
                {/* Horizontal candidates row */}
                <div className="flex justify-center gap-x-4 gap-y-2 flex-wrap max-h-[85px] overflow-y-auto py-1">
                  {election.candidates.map((cand, idx) => (
                    <div key={idx} className="flex flex-col items-center text-center space-y-1 w-[70px] shrink-0">
                      <div className="h-9 w-9 rounded-full border border-slate-400 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 shadow">
                        {isImageUrl(cand.symbol) ? (
                          <img src={cand.symbol} alt={cand.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-sm">{cand.symbol}</span>
                        )}
                      </div>
                      <p className="text-[9px] font-extrabold text-slate-900 leading-none truncate w-full">{cand.name}</p>
                      <p className="text-[7px] text-slate-500 leading-none truncate w-full">{cand.party}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-b border-slate-300 w-full pt-1"></div>

              {/* Mascot & Metadata block */}
              <div className="flex gap-3 items-center">
                {/* Mascot Panel */}
                <div className="h-[68px] w-[68px] bg-[#090d16] border border-slate-800 rounded-lg flex items-center justify-center shrink-0 shadow-inner">
                  <svg viewBox="0 0 16 16" className="w-11 h-11 text-[#FFD208] fill-current">
                    {PIXEL_SHIELD.map((row, rIdx) =>
                      row.split('').map((char, cIdx) =>
                        char === 'X' ? (
                          <rect key={`${rIdx}-${cIdx}`} x={cIdx} y={rIdx} width="1" height="1" />
                        ) : null
                      )
                    )}
                  </svg>
                </div>

                {/* Metadata table details */}
                <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[8.5px] font-mono leading-none">
                  <div className="space-y-0.5">
                    <span className="text-[6.5px] text-slate-500 block">[TALLY]</span>
                    <span className="font-bold text-slate-900">FHE SEALED</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[6.5px] text-slate-500 block">[BALLOTS]</span>
                    <span className="font-bold text-slate-900">{election.totalVotesCast} Cast</span>
                  </div>
                  <div className="col-span-2 space-y-0.5">
                    <span className="text-[6.5px] text-slate-500 block">[ADDRESS]</span>
                    <span className="font-bold text-slate-900 truncate block">
                      {electionAddress.substring(0, 10)}...{electionAddress.substring(electionAddress.length - 8)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom barcode and signature */}
              <div className="flex justify-between items-end border-t border-slate-300 pt-3">
                <div className="space-y-1">
                  <svg className="w-[85px] h-[18px] text-slate-900 fill-current">
                    {[1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1].map((w, idx) => {
                      const xOffset = [1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1]
                        .slice(0, idx)
                        .reduce((sum, val) => sum + val + 1.5, 0);
                      return (
                        <rect key={idx} x={xOffset} y={0} width={w} height={18} />
                      );
                    })}
                  </svg>
                  <span className="text-[6.5px] font-bold text-slate-500 font-mono block">
                    NET: SEPOLIA TESTNET
                  </span>
                </div>

                <div className="text-right space-y-0.5">
                  <span className="text-[6px] font-bold text-slate-500 block uppercase">[signature]</span>
                  <span className="font-mono text-[9px] italic font-bold text-slate-900 block leading-none">
                    ~ Guardians ~
                  </span>
                </div>
              </div>

              {/* Bottom Banner */}
              <div className="w-full bg-slate-900 text-white py-1.5 rounded-lg text-center text-[7.5px] font-black tracking-wide uppercase select-none shadow">
                Encrypted & Verifiable with FHE!
              </div>

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
