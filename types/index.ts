export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  age: number | null;
  goal: string | null;
  training_state: string | null;
  injuries: string | null;
  days_per_week: number;
  commitment_answer: string | null;
  body_weight_kg: number | null;
  protein_target: number;
  calorie_target: number;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgrammeState {
  id: string;
  user_id: string;
  current_day: number;
  current_week: number;
  start_date: string;
  active: boolean;
}

export interface CheckIn {
  id: string;
  user_id: string;
  date: string;
  sleep_quality: number;
  morning_energy: number;
  stress_level: number;
  soreness: number;
  motivation: number;
  notes: string | null;
  weight_kg: number | null;
  edge_response: string | null;
  created_at: string;
}

export interface TrainingSession {
  id: string;
  user_id: string;
  session_type: string;
  session_number: number;
  completed_at: string | null;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
}

export interface ExerciseLog {
  id: string;
  session_id: string;
  user_id: string;
  exercise_name: string;
  sets_completed: number;
  reps: number | null;
  weight_kg: number | null;
  struggled: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface LessonCompletion {
  id: string;
  user_id: string;
  day_number: number;
  cycle: number;
  reflection: string | null;
  micro_action_done: boolean;
  end_of_day_score: number | null;
  completed_at: string;
}

export interface SleepLog {
  id: string;
  user_id: string;
  date: string;
  bedtime: string | null;
  wake_time: string | null;
  quality: number | null;
  duration_hours: number | null;
  created_at: string;
}

export interface AdminNote {
  id: string;
  user_id: string;
  note: string;
  created_by: string;
  created_at: string;
}

export interface LessonData {
  day: number;
  phase: string;
  phaseCode: string;
  title: string;
  content: string;
  voiceJournalPrompt: string;
  reflectionQuestions: string[];
  microAction: string;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  weight?: string;
  notes?: string;
  rest?: string;
  yt?: string; // YouTube demo URL — shown as tappable thumbnail in session view
  video?: string; // Own demo clip (mp4) — plays inline, looped and muted
  superset?: string; // Same letter on consecutive exercises = done back to back (e.g. "A")
  group?: string; // Optional-choice group, see SessionData.pick
  mode?: "sets" | "timed" | "interval"; // default "sets"
  intervals?: IntervalProtocol[]; // mode "interval": protocols, chosen by week
}

export interface IntervalProtocol {
  label: string; // e.g. "Sprint A"
  work: number; // seconds
  rest: number; // seconds
  rounds: number;
  blocks?: number; // default 1
  blockRest?: number; // seconds between blocks
  weeks?: "odd" | "even" | "all";
}

export interface SessionData {
  type: string;
  name: string;
  warmup?: string[];
  exercises: Exercise[];
  finisher?: string;
  coachNote?: string;
  pick?: { group: string; count: number; label?: string }; // "pick 4 of these 5"
}

// ── Per-client programme (stored as JSONB in client_programmes) ──────────────
// Mirrors the shape the Train/Guide pages render. One document per client.
export interface ProgrammeWeek {
  week: number;
  label: string;
  sets: string;
  rpe: string;
  change: string;
}

export interface ProgrammeScheduleDay {
  day: string; // Mon, Tue, …
  label: string;
  sessionKey: string | null; // key into ClientProgramme.sessions
  type: "lift" | "cardio" | "rest";
  fromWeek?: number; // if set, this day's session only appears from this week onward
}

export interface ProgrammeCardioBlock {
  label: string;
  days: string;
  setup?: string;
  rule?: string;
  timingTip?: string;
  byWeek: { week: number; duration?: string; format?: string }[];
}

export interface Programme {
  id: string;
  title: string;
  subtitle: string;
  owner: string;
  lengthWeeks: number;
  summary: string;
  considerations: string[];
  rpeNote: string;
  weeklySchedule: ProgrammeScheduleDay[];
  progression: ProgrammeWeek[];
  progressionRule: string;
  cardio: { inclineWalk: ProgrammeCardioBlock; assaultBike: ProgrammeCardioBlock };
  nutrition: {
    headline: string;
    targets: string[];
    tactics: string[];
    proteinTarget: number;
    calorieTarget: number;
    medicalLabel: string;   // e.g. "Heart — guidance only" / "Diabetes — guidance only"
    medicalNote: string;
    recipes: Recipe[];      // client's own meal ideas, shown on the Fuel tab
  };
  checkIn: {
    frequency: string;
    fields: string[];
    photoNote: string;
  };
}

export interface Recipe {
  emoji: string;
  tag: string;      // Breakfast | Lunch | Dinner | Snack
  name: string;
  kcal: number;
  p: number;        // protein grams
  time: number;     // minutes
  desc: string;
  steps: string[];
}

export interface ClientProgramme {
  programme: Programme;
  sessions: Record<string, SessionData>;
}
