import { safeStorage } from 'electron';

export class CredentialService {
  /**
   * 加密明文字符串并返回 hex 格式
   * @param text 要加密的明文
   * @returns 加密后的 hex 字符串
   */
  static encrypt(text: string): string | null {
    if (!text) return null;

    if (safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = safeStorage.encryptString(text);
        return buffer.toString('hex');
      } catch (error) {
        console.error('Failed to encrypt with safeStorage:', error);
        return null;
      }
    }

    console.warn('safeStorage is not available. Falling back to simple hex encoding.');
    return Buffer.from(text, 'utf-8').toString('hex');
  }

  /**
   * 解密 hex 格式的字符串并返回明文
   * @param hex 要解密的 hex 字符串
   * @returns 解密后的明文
   */
  static decrypt(hex: string): string | null {
    if (!hex) return null;

    if (safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = Buffer.from(hex, 'hex');
        return safeStorage.decryptString(buffer);
      } catch (error) {
        console.error('Failed to decrypt with safeStorage:', error);
        return null;
      }
    }

    console.warn('safeStorage is not available. Falling back to simple hex decoding.');
    try {
      return Buffer.from(hex, 'hex').toString('utf-8');
    } catch (error) {
      console.error('Failed to decode hex:', error);
      return null;
    }
  }
}
