export const ENTRY_TYPES = [
  "Session",
  "Partner meeting",
  "Team meeting",
  "Deliverable",
  "Deadline",
  "Task",
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export type Entry = {
  id: string;
  user_id: string;
  title: string;
  type: EntryType;
  entry_date: string; // YYYY-MM-DD
  entry_time: string | null; // HH:MM:SS
  place: string | null;
  meeting_link: string | null;
  notes: string | null;
  mandatory: boolean;
  tbc: boolean;
  done: boolean;
  cancelled: boolean;
  moved: boolean;
  moved_from: string | null;
  attendance: "attended" | "missed" | null;
  created_at: string;
  updated_at: string;
};

export type Lab = {
  id: string;
  name: string;
  area: "Consultancy" | "Social Impact" | "Entrepreneurship";
  seats: number;
  tagline: string;
  sort_order: number;
};

export type Round = {
  id: string;
  name: string;
  application_deadline: string;
  add_deadline: string;
  drop_deadline: string;
  batch_time: string;
  is_current: boolean;
  last_settled_at: string | null;
};

export type WaitlistSlot = { lab_id: string; position: number };

export type MyResult = {
  round_id: string;
  user_id: string;
  lab_id: string | null;
  choice_rank: number | null;
  waitlist: WaitlistSlot[];
  previous_lab_id: string | null;
  changed_at: string | null;
  computed_at: string;
};

export type MyStatus = {
  round: Round | null;
  lottery_number: number | null;
  submitted_at: string | null;
  dropped_at: string | null;
  result: MyResult | null;
};

export type RankingRow = {
  id: string;
  round_id: string;
  lab_id: string;
  rank: number;
  reason: string | null;
};
