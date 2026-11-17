export {};

declare global {
  interface Window {
    nightfallDesktop?: {
      saveBackupText?: (suggestedName: string, content: string) => Promise<boolean>;
      show?: (input: {
        title: string;
        message: string;
        confirmLabel: string;
        cancelLabel?: string;
        destructive?: boolean;
      }) => Promise<boolean>;
    };
  }
}
