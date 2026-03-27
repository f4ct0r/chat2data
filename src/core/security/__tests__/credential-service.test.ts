import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { CredentialService } from '../credential-service';
import { sqliteService } from '../../storage/sqlite-service';

// Mock electron
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn(),
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));

// Mock sqliteService
vi.mock('../../storage/sqlite-service', () => ({
  sqliteService: {
    setSetting: vi.fn(),
    getSetting: vi.fn(),
  },
}));

// Need to get the mocked safeStorage
import { safeStorage } from 'electron';

describe('CredentialService', () => {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeAll(() => {
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('encrypt', () => {
    it('returns null if text is empty', () => {
      expect(CredentialService.encrypt('')).toBeNull();
    });

    it('encrypts using safeStorage when available', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
      const mockBuffer = Buffer.from('encrypted_data');
      vi.mocked(safeStorage.encryptString).mockReturnValue(mockBuffer);

      const result = CredentialService.encrypt('my_secret_key');
      
      expect(safeStorage.encryptString).toHaveBeenCalledWith('my_secret_key');
      expect(result).toBe(mockBuffer.toString('hex'));
    });

    it('falls back to simple hex encoding when safeStorage is not available', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);

      const result = CredentialService.encrypt('my_secret_key');
      
      expect(safeStorage.encryptString).not.toHaveBeenCalled();
      expect(result).toBe(Buffer.from('my_secret_key', 'utf-8').toString('hex'));
      expect(console.warn).toHaveBeenCalledWith('safeStorage is not available. Falling back to simple hex encoding.');
    });

    it('returns null and logs error if safeStorage throws', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
      vi.mocked(safeStorage.encryptString).mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      const result = CredentialService.encrypt('my_secret_key');
      
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Failed to encrypt with safeStorage:', expect.any(Error));
    });
  });

  describe('decrypt', () => {
    it('returns null if hex is empty', () => {
      expect(CredentialService.decrypt('')).toBeNull();
    });

    it('decrypts using safeStorage when available', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
      vi.mocked(safeStorage.decryptString).mockReturnValue('my_secret_key');

      const hexData = Buffer.from('encrypted_data').toString('hex');
      const result = CredentialService.decrypt(hexData);
      
      expect(safeStorage.decryptString).toHaveBeenCalledWith(Buffer.from(hexData, 'hex'));
      expect(result).toBe('my_secret_key');
    });

    it('falls back to simple hex decoding when safeStorage is not available', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);

      const hexData = Buffer.from('my_secret_key', 'utf-8').toString('hex');
      const result = CredentialService.decrypt(hexData);
      
      expect(safeStorage.decryptString).not.toHaveBeenCalled();
      expect(result).toBe('my_secret_key');
      expect(console.warn).toHaveBeenCalledWith('safeStorage is not available. Falling back to simple hex decoding.');
    });

    it('returns null and logs error if safeStorage throws', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
      vi.mocked(safeStorage.decryptString).mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const hexData = Buffer.from('encrypted_data').toString('hex');
      const result = CredentialService.decrypt(hexData);
      
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Failed to decrypt with safeStorage:', expect.any(Error));
    });
  });

  describe('saveApiKey and getApiKey', () => {
    it('saves empty string when apiKey is empty', () => {
      CredentialService.saveApiKey('openai', '');
      expect(sqliteService.setSetting).toHaveBeenCalledWith('api_key_openai', '');
    });

    it('encrypts and saves API key', () => {
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
      const mockBuffer = Buffer.from('encrypted_key');
      vi.mocked(safeStorage.encryptString).mockReturnValue(mockBuffer);

      CredentialService.saveApiKey('openai', 'my_api_key');
      
      expect(sqliteService.setSetting).toHaveBeenCalledWith('api_key_openai', mockBuffer.toString('hex'));
    });

    it('gets and decrypts API key', () => {
      const mockHex = Buffer.from('encrypted_key').toString('hex');
      vi.mocked(sqliteService.getSetting).mockReturnValue(mockHex);
      
      vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
      vi.mocked(safeStorage.decryptString).mockReturnValue('my_api_key');

      const result = CredentialService.getApiKey('openai');
      
      expect(result).toBe('my_api_key');
      expect(safeStorage.decryptString).toHaveBeenCalledWith(Buffer.from(mockHex, 'hex'));
    });

    it('returns null if setting is not found', () => {
      vi.mocked(sqliteService.getSetting).mockReturnValue(null);
      const result = CredentialService.getApiKey('openai');
      expect(result).toBeNull();
    });
  });

  describe('Privacy Consent', () => {
    it('saves true consent as string', () => {
      CredentialService.savePrivacyConsent(true);
      expect(sqliteService.setSetting).toHaveBeenCalledWith('privacy_consented', 'true');
    });

    it('saves false consent as string', () => {
      CredentialService.savePrivacyConsent(false);
      expect(sqliteService.setSetting).toHaveBeenCalledWith('privacy_consented', 'false');
    });

    it('gets consent as boolean true', () => {
      vi.mocked(sqliteService.getSetting).mockReturnValue('true');
      expect(CredentialService.getPrivacyConsent()).toBe(true);
    });

    it('gets consent as boolean false', () => {
      vi.mocked(sqliteService.getSetting).mockReturnValue('false');
      expect(CredentialService.getPrivacyConsent()).toBe(false);
    });
  });
});
