import { useState, useEffect, useCallback } from 'react';
import { initSDK, createInstance, SepoliaConfig, type FhevmInstance } from '@zama-fhe/relayer-sdk/web';
import { ethers } from 'ethers';
import { DOCUMENT_TYPE_MAP, type IdentityFormData } from '../utils/types';

let initPromise: Promise<FhevmInstance> | null = null;

export function useFhevm(provider: any, chainId: bigint) {
  const [fhevmInstance, setFhevmInstance] = useState<FhevmInstance | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [fheError, setFheError] = useState<string>('');

  const initFhe = useCallback(async () => {
    if (!provider || !chainId) return;

    setIsInitializing(true);
    setFheError('');

    if (!initPromise) {
      initPromise = (async () => {
        console.log('Initializing FHE WebAssembly SDK...');
        // 1. Initialize SDK (loads WASM)
        await initSDK();
        console.log('FHE WebAssembly loaded.');

        // 2. Create Instance using SepoliaConfig
        const config = {
          ...SepoliaConfig,
          network: window.location.origin + '/api/rpc',
          relayerUrl: window.location.origin + '/api/relayer/v2',
        };

        console.log('Creating FhevmInstance with SepoliaConfig...');
        return await createInstance(config);
      })();
    }

    try {
      const instance = await initPromise;
      setFhevmInstance(instance);
      console.log('FhevmInstance created/retrieved successfully.');
    } catch (err: any) {
      console.error('FHEVM initialization failed:', err);
      setFheError(err.message || 'Failed to initialize FHEVM.');
      initPromise = null; // Clear promise on failure to allow retry
    } finally {
      setIsInitializing(false);
    }
  }, [provider, chainId]);

  useEffect(() => {
    if (provider && chainId) {
      initFhe();
    }
  }, [provider, chainId, initFhe]);

  const encryptChoice = useCallback(async (
    contractAddress: string,
    userAddress: string,
    choice: number
  ) => {
    if (!fhevmInstance) {
      throw new Error('FHEVM SDK is not initialized yet.');
    }

    try {
      console.log(`Encrypting choice ${choice} for contract ${contractAddress} and voter ${userAddress}...`);
      const input = fhevmInstance.createEncryptedInput(contractAddress, userAddress);
      input.add8(choice); // candidate index fits in 8 bits (euint8)
      
      const encrypted = await input.encrypt();
      
      // Convert Uint8Array to hex string (ethers v6 format)
      const handle = ethers.hexlify(encrypted.handles[0]);
      const inputProof = ethers.hexlify(encrypted.inputProof);
      
      console.log('Encryption successful. Handle:', handle);
      return { handle, inputProof };
    } catch (err: any) {
      console.error('Encryption failed:', err);
      throw new Error(err.message || 'FHE Encryption failed.');
    }
  }, [fhevmInstance]);

  const encryptIdentityDocument = useCallback(async (
    formData: IdentityFormData,
    contractAddress: string,
    userAddress: string
  ) => {
    if (!fhevmInstance) {
      throw new Error('FHEVM SDK is not initialized yet.');
    }

    try {
      console.log('Encrypting identity document client-side...');
      
      // Combine all form fields into document string
      const documentString = [
        `NAME:${formData.fullName}`,
        `ID:${formData.idNumber}`,
        `DOB:${formData.dateOfBirth}`,
        `ADDR:${formData.address}`,
        `INFO:${formData.additionalInfo}`
      ].join('|');

      // Generate commitment hash (public proof of document)
      const encoder = new TextEncoder();
      const encoded = encoder.encode(documentString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
      const commitmentHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Encrypt document in 32-byte chunks as euint256
      const CHUNK_SIZE = 32;
      const numChunks = Math.ceil(encoded.length / CHUNK_SIZE);
      const encryptedChunks: string[] = [];
      const inputProofs: string[] = [];

      for (let i = 0; i < numChunks; i++) {
        const chunk = new Uint8Array(CHUNK_SIZE);
        chunk.set(encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
        
        // Convert to BigInt (big-endian)
        const bigintVal = chunk.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
        
        const input = fhevmInstance.createEncryptedInput(contractAddress, userAddress);
        input.add256(bigintVal);
        const enc = await input.encrypt();
        
        // Hexlify handles and input proofs for ethers compatibility
        encryptedChunks.push(ethers.hexlify(enc.handles[0]));
        inputProofs.push(ethers.hexlify(enc.inputProof));
      }

      // Encrypt document type as euint8
      const docTypeValue = DOCUMENT_TYPE_MAP[formData.documentType];
      const typeInput = fhevmInstance.createEncryptedInput(contractAddress, userAddress);
      typeInput.add8(docTypeValue);
      const typeEnc = await typeInput.encrypt();

      return {
        encryptedChunks,
        inputProofs,
        encryptedDocType: ethers.hexlify(typeEnc.handles[0]),
        docTypeProof: ethers.hexlify(typeEnc.inputProof),
        commitmentHash: '0x' + commitmentHash
      };
    } catch (err: any) {
      console.error('Identity document encryption failed:', err);
      throw new Error(err.message || 'Identity encryption failed.');
    }
  }, [fhevmInstance]);

  return {
    fhevmInstance,
    isInitializing,
    fheError,
    encryptChoice,
    encryptIdentityDocument,
    reinitialize: initFhe
  };
}
