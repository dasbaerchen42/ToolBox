export type FullwidthCustomRule = {
  id: string;
  from: string;
  to: string;
  enabled: boolean;
};

export type FullwidthOptions = {
  convertColon: boolean;
  convertComma: boolean;
  convertQuestion: boolean;
  convertExclamation: boolean;
  convertPeriod: boolean;
  convertSemicolon: boolean;
  convertParentheses: boolean;
  convertBraces: boolean;
  convertQuotes: boolean;

  enableCustomReplace: boolean;

  protectLatinClauses: boolean;

  fixMiswrappedDialogueItalics: boolean;
};

export type ProtectResult = {
  text: string;
  restore: (text: string) => string;
};

export type TextMeta = {
  chars: number;
  lines: number;
};

export const DEFAULT_FULLWIDTH_OPTIONS: FullwidthOptions = {
  convertColon: true,
  convertComma: true,
  convertQuestion: true,
  convertExclamation: true,
  convertPeriod: false,
  convertSemicolon: true,
  convertParentheses: true,
  convertBraces: true,
  convertQuotes: false,

  enableCustomReplace: false,

  protectLatinClauses: true,

  fixMiswrappedDialogueItalics: false,
};

export const DEFAULT_CUSTOM_RULES: FullwidthCustomRule[] = [
  {
    id: "rule-ellipsis-1",
    from: "......",
    to: "……",
    enabled: true,
  },
];