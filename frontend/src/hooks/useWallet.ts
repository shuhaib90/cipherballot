import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
  useAppKitProvider,
  useDisconnect,
  useWalletInfo
} from '@reown/appkit/react';

export function useWallet() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAppKitNetwork();
  const { walletProvider } = useAppKitProvider('eip155');
  const { disconnect: walletDisconnect } = useDisconnect();
  const { walletInfo } = useWalletInfo();

  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // References to cache the BrowserProvider instantiation and avoid render storms
  const lastWalletProviderRef = useRef<any>(null);
  const lastAddressRef = useRef<string>('');

  const disconnect = useCallback(async () => {
    try {
      await walletDisconnect();
      setProvider(null);
      setSigner(null);
      setError('');
      setHasInteracted(false);
      lastWalletProviderRef.current = null;
      lastAddressRef.current = '';
    } catch (err: any) {
      console.error('Wallet disconnect error:', err);
    }
  }, [walletDisconnect]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError('');
    setHasInteracted(true);
    try {
      await open();
    } catch (err: any) {
      console.error('Wallet connection modal error:', err);
      setError(err.message || 'Failed to open connection modal.');
    } finally {
      setIsConnecting(false);
    }
  }, [open]);

  // Extract primitive string to avoid depending on full walletInfo object reference
  const walletName = walletInfo?.name;

  // Sync provider and signer when walletProvider changes or isConnected changes
  useEffect(() => {
    // Only re-initialize if the underlying provider or wallet address has actually changed
    if (walletProvider === lastWalletProviderRef.current && (address || '') === lastAddressRef.current) {
      return;
    }

    lastWalletProviderRef.current = walletProvider;
    lastAddressRef.current = address || '';

    const initProvider = async () => {
      if (isConnected && walletProvider) {
        // Detect if MetaMask is being used (only check walletInfo.name to prevent false positives from other wallets spoofing MetaMask)
        const isMetaMask = !!walletName?.toLowerCase().includes('metamask');

        if (isMetaMask) {
          if (hasInteracted) {
            setError('MetaMask is not supported. Please connect using any other EVM wallet.');
          }
          try {
            await walletDisconnect();
          } catch (e) {
            console.error('Failed to disconnect MetaMask:', e);
          }
          setProvider(null);
          setSigner(null);
          return;
        }

        try {
          console.log("Wrapping new WalletConnect provider with Ethers...");
          const tempProvider = new BrowserProvider(walletProvider as any);
          const tempSigner = await tempProvider.getSigner();
          setProvider(tempProvider);
          setSigner(tempSigner);
        } catch (err: any) {
          console.error('Error wrapping WalletConnect provider with Ethers:', err);
          setError(err.message || 'Failed to wrap Web3 provider.');
        }
      } else {
        setProvider(null);
        setSigner(null);
      }
    };

    initProvider();
  }, [isConnected, walletProvider, walletName, walletDisconnect, hasInteracted, address]);

  return {
    provider,
    signer,
    address: address || '',
    chainId: chainId ? BigInt(chainId) : 0n,
    isConnected: !!isConnected,
    isConnecting,
    error,
    connect,
    disconnect
  };
}
