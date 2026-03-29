import { AppLanguage } from '../../shared/types';
import { safeStorage } from 'electron';
import { sqliteService } from '../storage/sqlite-service';

const DEFAULT_APP_LANGUAGE: AppLanguage = 'zh-CN';

const isSupportedLanguage = (value: string | null): value is AppLanguage =>
  value === 'zh-CN' || value === 'en-US';

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

  /**
   * 保存 LLM API Key
   * @param provider 提供商，例如 'openai' 或 'anthropic'
   * @param apiKey 明文 API Key
   */
  static saveApiKey(provider: string, apiKey: string): void {
    if (!apiKey) {
      sqliteService.setSetting(`api_key_${provider}`, '');
      return;
    }
    const encrypted = this.encrypt(apiKey);
    if (encrypted) {
      sqliteService.setSetting(`api_key_${provider}`, encrypted);
    }
  }

  /**
   * 获取并解密 LLM API Key
   * @param provider 提供商，例如 'openai' 或 'anthropic'
   * @returns 解密后的明文 API Key
   */
  static getApiKey(provider: string): string | null {
    const encrypted = sqliteService.getSetting(`api_key_${provider}`);
    if (!encrypted) return null;
    return this.decrypt(encrypted);
  }

  /**
   * 保存隐私协议同意状态
   * @param consented 是否同意
   */
  static savePrivacyConsent(consented: boolean): void {
    sqliteService.setSetting('privacy_consented', consented ? 'true' : 'false');
  }

  /**
   * 获取隐私协议同意状态
   * @returns 是否已同意
   */
  static getPrivacyConsent(): boolean {
    const val = sqliteService.getSetting('privacy_consented');
    return val === 'true';
  }

  static saveAppLanguage(language: AppLanguage): void {
    sqliteService.setSetting('app_language', language);
  }

  static getAppLanguage(): AppLanguage {
    const value = sqliteService.getSetting('app_language');
    return isSupportedLanguage(value) ? value : DEFAULT_APP_LANGUAGE;
  }
}
