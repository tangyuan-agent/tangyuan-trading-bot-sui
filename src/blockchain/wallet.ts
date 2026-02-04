import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import logger from '../utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

interface EncryptedWallet {
  ciphertext: string;
  iv: string;
  authTag: string;
  salt: string;
}

export class WalletManager {
  private keypair: Ed25519Keypair | null = null;
  private address: string | null = null;
  
  getKeypair(): Ed25519Keypair {
    if (!this.keypair) {
      throw new Error('Wallet not loaded. Call loadFromPrivateKey or loadFromFile first.');
    }
    return this.keypair;
  }
  
  getAddress(): string {
    if (!this.address) {
      throw new Error('Wallet not loaded.');
    }
    return this.address;
  }
  
  loadFromPrivateKey(privateKeyBase64: string): void {
    try {
      const privateKeyBytes = fromBase64(privateKeyBase64);
      this.keypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      this.address = this.keypair.getPublicKey().toSuiAddress();
      
      logger.info({ address: this.address }, 'Wallet loaded from private key');
    } catch (error) {
      logger.error({ error }, 'Failed to load wallet from private key');
      throw error;
    }
  }
  
  async loadFromEncryptedFile(filePath: string, password: string): Promise<void> {
    try {
      const encryptedData = await fs.readFile(filePath, 'utf-8');
      const encrypted: EncryptedWallet = JSON.parse(encryptedData);
      
      const privateKeyBase64 = this.decrypt(encrypted, password);
      this.loadFromPrivateKey(privateKeyBase64);
      
      logger.info({ filePath, address: this.address }, 'Wallet loaded from encrypted file');
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to load wallet from file');
      throw error;
    }
  }
  
  async saveToEncryptedFile(
    privateKeyBase64: string,
    filePath: string,
    password: string
  ): Promise<void> {
    try {
      const encrypted = this.encrypt(privateKeyBase64, password);
      await fs.writeFile(filePath, JSON.stringify(encrypted, null, 2), { mode: 0o600 });
      
      logger.info({ filePath }, 'Wallet saved to encrypted file');
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to save wallet to file');
      throw error;
    }
  }
  
  private encrypt(data: string, password: string): EncryptedWallet {
    const salt = crypto.randomBytes(KEY_LENGTH);
    const key = crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256');
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let ciphertext = cipher.update(data, 'utf8', 'base64');
    ciphertext += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    return {
      ciphertext,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      salt: salt.toString('base64'),
    };
  }
  
  private decrypt(encrypted: EncryptedWallet, password: string): string {
    const salt = Buffer.from(encrypted.salt, 'base64');
    const key = crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256');
    
    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

export function createWallet(): WalletManager {
  return new WalletManager();
}
