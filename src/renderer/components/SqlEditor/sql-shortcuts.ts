interface SqlExecuteShortcutInput {
  platform: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}

const isMacPlatform = (platform: string) => /mac/i.test(platform);

export const isSqlExecuteShortcut = ({
  platform,
  key,
  metaKey,
  ctrlKey,
}: SqlExecuteShortcutInput): boolean => {
  if (key !== 'Enter') {
    return false;
  }

  return isMacPlatform(platform) ? metaKey : ctrlKey;
};

