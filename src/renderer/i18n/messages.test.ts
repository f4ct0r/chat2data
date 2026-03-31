import { describe, expect, it } from 'vitest';
import { defaultLanguage, isSupportedLanguage, messages } from './messages';

describe('renderer i18n messages', () => {
  it('uses zh-CN as the default language', () => {
    expect(defaultLanguage).toBe('zh-CN');
  });

  it('supports zh-CN and en-US', () => {
    expect(isSupportedLanguage('zh-CN')).toBe(true);
    expect(isSupportedLanguage('en-US')).toBe(true);
    expect(isSupportedLanguage('fr-FR')).toBe(false);
  });

  it('contains translated strings for key settings and privacy copy', () => {
    expect(messages['zh-CN']['settings.title']).toBe('系统设置');
    expect(messages['en-US']['settings.title']).toBe('Settings');
    expect(messages['zh-CN']['settings.language.label']).toBe('界面语言');
    expect(messages['en-US']['settings.language.label']).toBe('Language');
    expect(messages['zh-CN']['privacy.title']).toBe('隐私与数据安全说明');
    expect(messages['en-US']['privacy.title']).toBe('Privacy & Data Security');
  });

  it('contains editable preview strings in both supported languages', () => {
    expect(messages['zh-CN']['editablePreview.apply']).toBeDefined();
    expect(messages['en-US']['editablePreview.apply']).toBeDefined();
    expect(messages['zh-CN']['editablePreview.refreshFailedApplied']).toBeDefined();
    expect(messages['en-US']['editablePreview.refreshFailedApplied']).toBeDefined();
  });
});
