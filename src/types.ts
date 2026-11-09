export type Profile = {
  college: string;
  subject: string;
  reg: string;
  year: string;
  name: string;
  roll: string;
  cls: string;
};

export type Draft = {
  question: string;
  output: string;
  code: string;
};

export type Entry = Draft & {
  topic: string;
};

export type StoredState = {
  profile?: Partial<Profile>;
  draft?: Partial<Draft>;
  entries?: Entry[];
  topic?: string;
  collectedProblems?: Array<Record<string, unknown>>;
};
