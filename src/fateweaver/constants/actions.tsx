export type MastermindActionId =
  | "VerticalMove"
  | "HorizontalMove"
  | "DiagonalMove"
  | "GainParanoia"
  | "LoseParanoia"
  | "ForbidParanoia"
  | "ForbidGoodwill"
  | "GainIntrigue"
  | "GainIntrigue2";

export const MASTERMIND_ACTIONS_I18N: Record<MastermindActionId, string> = {
  VerticalMove:   "↑↓ 移动",
  HorizontalMove: "←→ 移动",
  DiagonalMove:   "斜向移动",
  GainParanoia:   "不安 +1",
  LoseParanoia:   "不安 -1",
  ForbidParanoia: "禁止不安",
  ForbidGoodwill: "禁止友好",
  GainIntrigue:   "密谋 +1",
  GainIntrigue2:  "密谋 +2",
};

export const ALL_MASTERMIND_ACTIONS: MastermindActionId[] =
  Object.keys(MASTERMIND_ACTIONS_I18N) as MastermindActionId[];

export type ProtagonistActionId =
  | "GainGoodwill"
  | "GainGoodwill2"
  | "LoseParanoia"
  | "ForbidMove"
  | "ForbidIntrigue"
  | "VerticalMove"
  | "GainParanoia"
  | "HorizontalMove";

export const PROTAGONIST_ACTIONS_I18N: Record<ProtagonistActionId, string> = {
  ForbidMove:      "禁止移动",
  GainGoodwill2:   "友好 +2",
  LoseParanoia:    "不安 -1",
  ForbidIntrigue:  "禁止密谋",
  VerticalMove:    "↑↓ 移动",
  HorizontalMove:  "←→ 移动",
  GainGoodwill:    "友好 +1",
  GainParanoia:    "不安 +1",
};

export const ALL_PROTAGONIST_ACTIONS: ProtagonistActionId[] =
  Object.keys(PROTAGONIST_ACTIONS_I18N) as ProtagonistActionId[];
