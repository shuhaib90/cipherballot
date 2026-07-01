import { Vote, Wallet, Shield, Key, RefreshCw, HelpCircle, Users, ClipboardList, Sun, Moon } from 'lucide-react';

interface HeaderProps {
  address: string;
  isConnected: boolean;
  isOfficer: boolean;
  isFheReady: boolean;
  isFheInitializing: boolean;
  chainId: bigint;
  connectWallet: () => void;
  disconnectWallet: () => void;
  reinitFhe: () => void;
  activeTab: 'landing' | 'register' | 'elections' | 'voter-status' | 'commission' | 'how-it-works' | 'docs';
  setActiveTab: (tab: 'landing' | 'register' | 'elections' | 'voter-status' | 'commission' | 'how-it-works' | 'docs') => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export function Header({
  address,
  isConnected,
  isOfficer,
  isFheReady,
  isFheInitializing,
  chainId,
  connectWallet,
  disconnectWallet,
  reinitFhe,
  activeTab,
  setActiveTab,
  theme,
  toggleTheme
}: HeaderProps) {
  // Helper to truncate address
  const truncateAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const navItems = [
    { id: 'register' as const, label: 'Claim FHE Pass', icon: <Shield className="h-4 w-4" /> },
    { id: 'elections' as const, label: 'Shielded Polls', icon: <Vote className="h-4 w-4" /> },
    { id: 'voter-status' as const, label: 'Credential Status', icon: <Users className="h-4 w-4" /> },
    { id: 'how-it-works' as const, label: 'Mechanics', icon: <HelpCircle className="h-4 w-4" /> },
    ...(isOfficer
      ? [{ id: 'commission' as const, label: 'Guardian Hub', icon: <ClipboardList className="h-4 w-4" /> }]
      : [])
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-yellow-500/10 bg-[#080808]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and Tagline */}
        <div className="flex items-center gap-2.5 shrink-0 cursor-pointer" onClick={() => setActiveTab('landing')}>
          <img src="/logo.png" alt="CipherBallot Logo" className="h-9 w-9 object-contain" />
          <div>
            <span className="font-sans text-lg font-black tracking-tight bg-gradient-to-r from-white to-yellow-300 bg-clip-text text-transparent">
              CipherBallot
            </span>
          </div>
        </div>

        {/* Center Navigation Menu (Only when connected) */}
        {isConnected && (
          <nav className="hidden md:flex items-center gap-1.5 px-1.5 py-1 bg-slate-950/40 rounded-full border border-yellow-500/5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full transition-all duration-200 ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-[#FFD208] to-[#E5B800] text-black shadow-sm shadow-yellow-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-yellow-950/10'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        )}

        {/* Right Status Controls */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-yellow-500/10 bg-[#141414] hover:bg-[#1f1f1f]/80 text-[#FFD208] hover:text-yellow-300 transition duration-200"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>

          {/* FHE Status Indicator */}
          {isConnected && (
            <button
              onClick={reinitFhe}
              disabled={isFheInitializing}
              title="Click to reload FHE SDK"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold border transition duration-200 ${
                isFheReady
                  ? 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20 hover:bg-emerald-500/20'
                  : isFheInitializing
                  ? 'bg-amber-500/10 text-amber-450 border-amber-500/20 animate-pulse'
                  : 'bg-rose-500/10 text-rose-450 border-rose-500/20 hover:bg-rose-500/20'
              }`}
            >
              {isFheInitializing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Key className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {isFheReady ? 'FHE Active' : isFheInitializing ? 'Initializing...' : 'FHE Inactive'}
              </span>
            </button>
          )}

          {/* Wallet Connection */}
          {isConnected ? (
            <div className="flex items-center rounded-full bg-[#141414] border border-yellow-500/10 p-1">
              <div className="flex items-center gap-2 px-3 py-1 text-xs text-slate-300 font-semibold">
                <Wallet className="h-3.5 w-3.5 text-[#FFD208]" />
                <span className="hidden lg:inline text-slate-400">
                  {chainId.toString() === '31337' ? 'Hardhat' : 'Sepolia'}
                </span>
                <span className="h-1 w-1 rounded-full bg-[#FFD208]/30"></span>
                <span className="text-yellow-100">{truncateAddress(address)}</span>
              </div>
              <button
                onClick={disconnectWallet}
                className="rounded-full px-3 py-1 text-xs font-bold text-slate-400 hover:text-white hover:bg-yellow-950/20 transition duration-150"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="btn-primary py-2 text-xs sm:text-sm px-5"
            >
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </button>
          )}
        </div>
      </div>
      
      {/* Mobile Navigation Bar (Only when connected) */}
      {isConnected && (
        <nav className="flex md:hidden items-center justify-around border-t border-yellow-500/5 bg-black/60 py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1 text-[10px] font-semibold transition-all duration-200 ${
                activeTab === item.id ? 'text-[#FFD208] font-bold' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {item.icon}
              <span className="scale-90">{item.label.split(' ')[0]}</span>
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}
