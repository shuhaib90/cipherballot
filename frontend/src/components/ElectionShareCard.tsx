import { useState } from 'react';
import { Download, Check, Link } from 'lucide-react';
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
      // X Post: 1200x675 (16:9 horizontal card)
      // Insta Story: 1080x1920 (9:16 vertical)
      canvas.width = isStory ? 1080 : 1200;
      canvas.height = isStory ? 1920 : 675;
      
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
      for (let i = 0; i < (isStory ? 200 : 100); i++) {
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

      // Load logo image
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = '/logo.png';
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve; // fallback gracefully if missing
      });

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
        size: number = 80
      ) => {
        c.save();
        // Outer avatar ring
        c.fillStyle = '#0f172a';
        c.strokeStyle = '#475569';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(cx, cy + size / 2, size / 2, 0, Math.PI * 2);
        c.fill();
        c.stroke();

        // Clip image
        if (typeof asset !== 'string') {
          c.beginPath();
          c.arc(cx, cy + size / 2, size / 2 - 1.5, 0, Math.PI * 2);
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
        c.font = 'bold 12px sans-serif';
        c.textAlign = 'center';
        c.fillText(cand.name, cx, cy + size + 18);

        // Candidate Party
        c.fillStyle = '#64748b';
        c.font = 'bold 9px sans-serif';
        c.fillText(cand.party.toUpperCase(), cx, cy + size + 30);
      };

      // Layout coordinates based on aspect ratio
      if (!isStory) {
        // ==========================================
        // HORIZONTAL X POST FORMAT (16:9: 1200x675)
        // ==========================================
        const cardX = 60;
        const cardY = 60;
        const cardW = 1080;
        const cardH = 555;

        ctx.save();
        drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24);
        ctx.fillStyle = getCardGrad(cardX, cardY, cardW, cardH);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Ticket notch cutouts at the dividing line (stub is 320px wide)
        const stubDividerX = cardX + 300;
        ctx.fillStyle = '#050508';
        ctx.beginPath();
        ctx.arc(stubDividerX, cardY, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(stubDividerX, cardY + cardH, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Dashed divider line
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.2)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(stubDividerX, cardY + 20);
        ctx.lineTo(stubDividerX, cardY + cardH - 20);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // --- STUB CONTENT (LEFT SECTION) ---
        // Draw Project Logo
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          ctx.drawImage(logoImg, cardX + 115, cardY + 45, 70, 70);
        }
        
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 16px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '3px';
        ctx.fillText('CIPHERBALLOT®', cardX + 150, cardY + 145);

        // Stub Mascot Box
        const mascotSize = 130;
        const mascotX = cardX + 85;
        const mascotY = cardY + 185;

        ctx.fillStyle = '#090d16';
        drawRoundedRect(ctx, mascotX, mascotY, mascotSize, mascotSize, 14);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw pixel shield in yellow
        ctx.fillStyle = '#FFD208';
        const startPixelX = mascotX + (mascotSize - (16 * 5.5)) / 2;
        const startPixelY = mascotY + (mascotSize - (16 * 5.5)) / 2;
        PIXEL_SHIELD.forEach((row, rIdx) => {
          row.split('').forEach((char, cIdx) => {
            if (char === 'X') {
              ctx.fillRect(startPixelX + cIdx * 5.5, startPixelY + rIdx * 5.5, 5.5, 5.5);
            }
          });
        });

        // Dynamic Barcode
        ctx.fillStyle = '#0f172a';
        let barX = cardX + 60;
        const barY = cardY + 345;
        const barH = 30;
        const pattern = [2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2];
        pattern.forEach((width) => {
          ctx.fillRect(barX, barY, width, barH);
          barX += width + 2;
        });

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 9px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`SECURITY: ZAMA FHEVM`, cardX + 150, cardY + 415);
        ctx.fillText(`BLOCKCHAIN AUTHENTICATED`, cardX + 150, cardY + 430);

        // --- MAIN TICKET CONTENT (RIGHT SECTION) ---
        const mainStartX = stubDividerX + 40;
        const mainWidth = cardW - 340 - 80;

        // Poll Name & Description
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 30px Outfit, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(election.name.toUpperCase(), mainStartX, cardY + 65);

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 13px sans-serif';
        const truncatedDesc = election.description.length > 95
          ? election.description.substring(0, 95) + '...'
          : election.description;
        ctx.fillText(truncatedDesc, mainStartX, cardY + 95);

        // Circular number badge top-right of main card
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(cardX + cardW - 60, cardY + 60, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Courier New, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`#${String(election.electionId).padStart(2, '0')}`, cardX + cardW - 60, cardY + 65);

        // Horizontal line separator
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(stubDividerX + 40, cardY + 120);
        ctx.lineTo(cardX + cardW - 40, cardY + 120);
        ctx.stroke();

        // Render ALL Candidates dynamically using grid
        const candsStartY = cardY + 145;
        const count = candidates.length;
        
        // Calculate dynamic columns & rows to prevent clipping
        let cols = 4;
        if (count > 4) cols = Math.min(count, 5);
        const rows = Math.ceil(count / cols);
        const colWidth = mainWidth / cols;
        const rowHeight = rows > 1 ? 120 : 140;
        const avatarSize = rows > 1 ? 55 : 72;

        for (let i = 0; i < count; i++) {
          const colIdx = i % cols;
          const rowIdx = Math.floor(i / cols);
          const cx = mainStartX + (colIdx * colWidth) + (colWidth / 2);
          const cy = candsStartY + (rowIdx * rowHeight);
          drawCanvasCandidate(ctx, candidates[i], loadedAssets[i], cx, cy, avatarSize);
        }

        // Horizontal line separator above metadata
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(stubDividerX + 40, cardY + 395);
        ctx.lineTo(cardX + cardW - 40, cardY + 395);
        ctx.stroke();

        // Metadata grid at bottom
        const metaY = cardY + 420;
        const drawSquareMeta = (lbl: string, val: string, ox: number, oy: number) => {
          ctx.fillStyle = '#64748b';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(`[${lbl.toUpperCase()}]`, ox, oy);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px Courier New, monospace';
          ctx.fillText(val, ox, oy + 18);
        };

        ctx.textAlign = 'left';
        drawSquareMeta('tally secrecy', 'FHE SEALED', mainStartX, metaY);
        drawSquareMeta('ballot count', `${election.totalVotesCast} Cast`, mainStartX + 140, metaY);
        drawSquareMeta('contract', electionAddress.substring(0, 16) + '...', mainStartX + 280, metaY);

        drawSquareMeta('authority', 'GUARDIANS', mainStartX + 460, metaY);
        drawSquareMeta('network', 'SEPOLIA', mainStartX + 585, metaY);

        // Bottom Banner Row
        ctx.fillStyle = '#0f172a';
        drawRoundedRect(ctx, mainStartX, cardY + 480, mainWidth, 40, 10);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 11px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '1px';
        ctx.fillText('ENCRYPTED & VERIFIABLE WITH FULLY HOMOMORPHIC ENCRYPTION (FHEVM)', mainStartX + mainWidth / 2, cardY + 504);

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
        ctx.lineWidth = 3.5;
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

        // Draw Project Logo on top card
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          ctx.drawImage(logoImg, 220, topY + 65, 70, 70);
          ctx.fillStyle = '#0f172a';
          ctx.font = '900 44px Outfit, sans-serif';
          ctx.textAlign = 'left';
          ctx.letterSpacing = '6px';
          ctx.fillText('CIPHERBALLOT®', 315, topY + 115);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.font = '900 46px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.letterSpacing = '8px';
          ctx.fillText('CIPHERBALLOT®', 540, topY + 120);
        }

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
        ctx.lineWidth = 3.5;
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

        // Candidates Section Title
        const candY = botY + 200;
        ctx.fillStyle = '#334155';
        ctx.font = '900 13px Outfit, sans-serif';
        ctx.letterSpacing = '2px';
        ctx.textAlign = 'center';
        ctx.fillText('SHIELDED CANDIDATES LIST', 540, candY);

        // Dynamic candidates grid block to fit ALL candidates
        const gridY = botY + 260;
        const count = candidates.length;
        let cols = 2;
        let avatarSize = 100;
        let rowHeight = 155;
        if (count > 6) {
          cols = 3; // use 3 columns to prevent overflowing vertical ticket
          avatarSize = 80;
          rowHeight = 130;
        }

        const colWidth = (botW - 160) / cols;
        const startGridX = botX + 80;

        for (let i = 0; i < count; i++) {
          const colIdx = i % cols;
          const rowIdx = Math.floor(i / cols);
          const cx = startGridX + (colIdx * colWidth) + (colWidth / 2);
          const cy = gridY + (rowIdx * rowHeight);
          drawCanvasCandidate(ctx, candidates[i], loadedAssets[i], cx, cy, avatarSize);
        }

        // Horizontal Separator
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(100, botY + 820);
        ctx.lineTo(980, botY + 820);
        ctx.stroke();

        // 8-Bit Mascot Box (Left side of bottom section)
        const mascotW = 180;
        const mascotH = 180;
        const mascotX = 120;
        const mascotY = botY + 860;

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

        // Passport Metadata Table
        ctx.textAlign = 'left';
        const metaX = 350;
        const metaY = botY + 880;

        const drawStoryMeta = (lbl: string, val: string, ox: number, oy: number) => {
          ctx.fillStyle = '#475569';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`[${lbl.toUpperCase()}]`, ox, oy);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 15px Courier New, monospace';
          ctx.fillText(val, ox, oy + 22);
        };

        drawStoryMeta('tally secrecy', 'FHE SEALED', metaX, metaY);
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
        ctx.moveTo(100, botY + 1110);
        ctx.lineTo(980, botY + 1110);
        ctx.stroke();
        ctx.setLineDash([]);

        // Barcode strip
        ctx.fillStyle = '#0f172a';
        let barcodeX = 120;
        const barcodeY = botY + 1150;
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
        ctx.fillText('[network signature]', 960, botY + 1140);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'italic bold 22px monospace';
        ctx.fillText('~ Network Guardians ~', 960, botY + 1172);

        ctx.fillStyle = '#475569';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('Issued: Block #5,291,402  |  Expires: Block #15,291,402', 960, botY + 1195);

        // Bottom Banner text block
        ctx.fillStyle = '#0f172a';
        drawRoundedRect(ctx, 120, botY + 1260, 820, 70, 16);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 17px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '1px';
        ctx.fillText('CIPHERBALLOT: VERIFIABLE DECENTRALIZED VOTING POWERED BY FHE', 530, botY + 1302);

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
    <div className="space-y-6">
      
      {/* Ratio Selector Switch */}
      <div className="flex justify-between items-center bg-slate-950 p-1.5 border border-slate-900 rounded-2xl w-full select-none shrink-0">
        <span className="text-xs font-bold text-slate-450 pl-3">Ratio Mode:</span>
        <div className="flex gap-1">
          <button
            onClick={() => setRatio('x_post')}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition ${
              ratio === 'x_post'
                ? 'bg-yellow-500 text-black shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            X Post (16:9)
          </button>
          <button
            onClick={() => setRatio('insta_story')}
            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition ${
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
      <div className="flex flex-col items-center py-6 px-4 bg-[#050508]/90 rounded-3xl border border-slate-900 shadow-2xl relative overflow-hidden">
        
        {/* Starfield backdrop effect */}
        <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
        
        {/* Dynamic layout container wrapper */}
        <div className={`w-full flex flex-col items-center transition-all duration-300 ${
          ratio === 'insta_story' ? 'max-w-[280px] space-y-3.5' : 'max-w-[460px] space-y-4'
        }`}>
          
          {ratio === 'x_post' ? (
            /* ========================================== */
            /* HORIZONTAL 16:9 PREVIEW CARD (X POST)      */
            /* ========================================== */
            <div className="w-full bg-gradient-to-br from-slate-200 via-slate-50 to-slate-300 border-2 border-slate-450 rounded-2xl text-slate-900 font-sans shadow-2xl relative select-none aspect-[16/9] flex overflow-hidden">
              {/* Notch Cutouts top/bottom on divider line */}
              <div className="absolute -top-3.5 left-[30%] -translate-x-1/2 w-7 h-7 rounded-full bg-[#050508] border-b-2 border-slate-400"></div>
              <div className="absolute -bottom-3.5 left-[30%] -translate-x-1/2 w-7 h-7 rounded-full bg-[#050508] border-t-2 border-slate-400"></div>

              {/* Stub Section (Left 30%) */}
              <div className="w-[30%] border-r border-dashed border-slate-400 flex flex-col justify-between items-center p-3 text-center shrink-0">
                <div className="space-y-0.5">
                  <img src="/logo.png" alt="Logo" className="h-6 w-6 mx-auto object-contain" />
                  <span className="font-mono text-[6px] font-black tracking-wider uppercase block text-slate-500 leading-none">CIPHERBALLOT</span>
                </div>

                {/* Stub Mascot Box */}
                <div className="h-14 w-14 bg-[#090d16] border border-slate-800 rounded-lg flex items-center justify-center shrink-0 shadow-inner">
                  <svg viewBox="0 0 16 16" className="w-9 h-9 text-[#FFD208] fill-current">
                    {PIXEL_SHIELD.map((row, rIdx) =>
                      row.split('').map((char, cIdx) =>
                        char === 'X' ? (
                          <rect key={`${rIdx}-${cIdx}`} x={cIdx} y={rIdx} width="1" height="1" />
                        ) : null
                      )
                    )}
                  </svg>
                </div>

                {/* Stub Barcode */}
                <div className="w-full">
                  <svg className="w-full h-3.5 text-slate-900 fill-current">
                    {[1, 2, 4, 1, 3, 2, 1, 4, 2].map((w, idx) => {
                      const xOffset = [1, 2, 4, 1, 3, 2, 1, 4, 2]
                        .slice(0, idx)
                        .reduce((sum, val) => sum + val + 1.5, 0);
                      return (
                        <rect key={idx} x={xOffset} y={0} width={w} height={14} />
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Main Ticket Area (Right 70%) */}
              <div className="flex-1 p-3 flex flex-col justify-between overflow-hidden relative">
                <div>
                  <div className="flex justify-between items-start gap-1">
                    <h5 className="font-sans text-slate-900 font-extrabold text-[12px] tracking-tight uppercase truncate leading-none pr-6">
                      {election.name}
                    </h5>
                    {/* Badge */}
                    <div className="absolute top-2.5 right-2.5 h-5 w-5 bg-slate-900 rounded-full flex items-center justify-center text-white font-mono text-[7.5px] font-bold">
                      #{String(election.electionId).padStart(2, '0')}
                    </div>
                  </div>
                  <p className="text-[6.5px] text-slate-500 font-semibold line-clamp-1 mt-0.5 max-w-[90%]">
                    {election.description}
                  </p>
                </div>

                {/* Divider */}
                <div className="border-b border-dashed border-slate-350 w-full pt-1"></div>

                {/* Candidates List Grid (Supports scrolling if large) */}
                <div className="space-y-1">
                  <span className="text-[6px] font-black text-slate-500 tracking-wider block text-center uppercase">
                    Shielded Candidates
                  </span>
                  
                  <div className="flex justify-center gap-x-2 gap-y-1 flex-wrap max-h-[85px] overflow-y-auto py-0.5">
                    {election.candidates.map((cand, idx) => (
                      <div key={idx} className="flex flex-col items-center text-center space-y-0.5 w-[52px] shrink-0">
                        <div className="h-6 w-6 rounded-full border border-slate-400 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 shadow">
                          {isImageUrl(cand.symbol) ? (
                            <img src={cand.symbol} alt={cand.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[8px]">{cand.symbol}</span>
                          )}
                        </div>
                        <p className="text-[7.5px] font-extrabold text-slate-900 leading-none truncate w-full">{cand.name}</p>
                        <p className="text-[5.5px] text-slate-500 leading-none truncate w-full">{cand.party}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metadata block */}
                <div className="flex justify-between items-center text-[7px] font-mono border-t border-slate-300 pt-1.5 leading-none">
                  <div>
                    <span className="text-[5.5px] text-slate-500 block">[TALLY]</span>
                    <span className="font-bold text-slate-900">FHE SEALED</span>
                  </div>
                  <div>
                    <span className="text-[5.5px] text-slate-500 block">[BALLOTS]</span>
                    <span className="font-bold text-slate-900">{election.totalVotesCast} Cast</span>
                  </div>
                  <div>
                    <span className="text-[5.5px] text-slate-500 block">[NET]</span>
                    <span className="font-bold text-slate-900">SEPOLIA</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================== */
            /* VERTICAL 9:16 PREVIEW CARD (INSTA STORY)   */
            /* ========================================== */
            <div className="w-full flex flex-col space-y-3.5">
              
              {/* Top Metallic Ticket */}
              <div className="w-full bg-gradient-to-br from-slate-200 via-slate-50 to-slate-300 border-2 border-slate-400 rounded-2xl p-4 flex items-center justify-center relative shadow-xl shrink-0">
                <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-[#050508] border-r-2 border-slate-400"></div>
                <div className="absolute top-1/2 -right-3.5 -translate-y-1/2 w-7 h-7 rounded-full bg-[#050508] border-l-2 border-slate-400"></div>
                
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain" />
                  <h4 className="font-mono text-slate-900 text-sm font-black tracking-[3px] uppercase select-none leading-none">
                    CipherBallot <span className="text-[7px] font-bold align-super">®</span>
                  </h4>
                </div>
              </div>

              {/* Bottom Metallic Ticket (Taller) */}
              <div className="w-full bg-gradient-to-br from-slate-200 via-slate-50 to-slate-300 border-2 border-slate-400 rounded-2xl p-4 flex flex-col relative shadow-xl text-slate-900 overflow-hidden h-[420px] justify-between">
                
                <div className="absolute top-[160px] -left-3.5 w-7 h-7 rounded-full bg-[#050508] border-r-2 border-slate-400"></div>
                <div className="absolute top-[160px] -right-3.5 w-7 h-7 rounded-full bg-[#050508] border-l-2 border-slate-400"></div>

                <div className="absolute bottom-[80px] -left-3.5 w-7 h-7 rounded-full bg-[#050508] border-r-2 border-slate-400"></div>
                <div className="absolute bottom-[80px] -right-3.5 w-7 h-7 rounded-full bg-[#050508] border-l-2 border-slate-400"></div>

                {/* Title Header */}
                <div className="text-center relative">
                  <h5 className="font-sans text-slate-900 font-extrabold text-xs tracking-wide uppercase truncate leading-tight pr-6">
                    {election.name}
                  </h5>
                  <p className="text-[7.5px] text-slate-500 font-semibold line-clamp-1 mt-0.5 max-w-[90%] mx-auto">
                    {election.description}
                  </p>
                  
                  {/* Circular ID Badge */}
                  <div className="absolute -top-1 -right-1 h-6 w-6 bg-slate-900 rounded-full flex items-center justify-center text-white font-mono text-[8px] font-bold shadow">
                    #{String(election.electionId).padStart(2, '0')}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-b border-dashed border-slate-350 w-full pt-1"></div>

                {/* Candidates vertical list */}
                <div className="space-y-1.5">
                  <span className="text-[7px] font-black text-slate-500 tracking-wider block text-center uppercase">
                    Shielded Candidates List
                  </span>
                  
                  <div className="flex justify-center gap-x-3 gap-y-1.5 flex-wrap max-h-[140px] overflow-y-auto py-0.5">
                    {election.candidates.map((cand, idx) => (
                      <div key={idx} className="flex flex-col items-center text-center space-y-0.5 w-[52px] shrink-0">
                        <div className="h-7 w-7 rounded-full border border-slate-400 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 shadow">
                          {isImageUrl(cand.symbol) ? (
                            <img src={cand.symbol} alt={cand.name} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-[10px]">{cand.symbol}</span>
                          )}
                        </div>
                        <p className="text-[8px] font-extrabold text-slate-900 leading-none truncate w-full">{cand.name}</p>
                        <p className="text-[6px] text-slate-500 leading-none truncate w-full">{cand.party}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-b border-slate-300 w-full pt-1"></div>

                {/* Mascot & Metadata block */}
                <div className="flex gap-2 items-center">
                  <div className="h-14 w-14 bg-[#090d16] border border-slate-800 rounded-lg flex items-center justify-center shrink-0 shadow-inner">
                    <svg viewBox="0 0 16 16" className="w-9 h-9 text-[#FFD208] fill-current">
                      {PIXEL_SHIELD.map((row, rIdx) =>
                        row.split('').map((char, cIdx) =>
                          char === 'X' ? (
                            <rect key={`${rIdx}-${cIdx}`} x={cIdx} y={rIdx} width="1" height="1" />
                          ) : null
                        )
                      )}
                    </svg>
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1 text-[8px] font-mono leading-none">
                    <div className="space-y-0.5">
                      <span className="text-[6px] text-slate-500 block">[TALLY]</span>
                      <span className="font-bold text-slate-900">FHE SEALED</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[6px] text-slate-500 block">[BALLOTS]</span>
                      <span className="font-bold text-slate-900">{election.totalVotesCast} Cast</span>
                    </div>
                    <div className="col-span-2 space-y-0.5">
                      <span className="text-[6px] text-slate-500 block">[ADDRESS]</span>
                      <span className="font-bold text-slate-900 truncate block">
                        {electionAddress.substring(0, 10)}...{electionAddress.substring(electionAddress.length - 8)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom barcode and signature */}
                <div className="flex justify-between items-end border-t border-slate-300 pt-2.5">
                  <div className="space-y-0.5">
                    <svg className="w-[75px] h-[14px] text-slate-900 fill-current">
                      {[1, 2, 4, 1, 3, 2, 1, 4, 2].map((w, idx) => {
                        const xOffset = [1, 2, 4, 1, 3, 2, 1, 4, 2]
                          .slice(0, idx)
                          .reduce((sum, val) => sum + val + 1.5, 0);
                        return (
                          <rect key={idx} x={xOffset} y={0} width={w} height={14} />
                        );
                      })}
                    </svg>
                    <span className="text-[6px] font-bold text-slate-500 font-mono block">
                      NET: SEPOLIA TESTNET
                    </span>
                  </div>

                  <div className="text-right space-y-0.5">
                    <span className="text-[5.5px] font-bold text-slate-500 block uppercase">[signature]</span>
                    <span className="font-mono text-[8px] italic font-bold text-slate-900 block leading-none">
                      ~ Guardians ~
                    </span>
                  </div>
                </div>

                {/* Bottom Banner */}
                <div className="w-full bg-slate-900 text-white py-1 rounded-lg text-center text-[7px] font-black tracking-wide uppercase select-none shadow">
                  Encrypted & Verifiable with FHE!
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3.5 pt-2">
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
  );
}

// Add a dummy refresh animation helper
function RefreshCw(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2055/svg"
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
