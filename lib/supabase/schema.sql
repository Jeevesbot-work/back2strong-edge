-- Edge App — Supabase Schema
-- Run this in your Supabase SQL editor

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  age INTEGER,
  goal TEXT,
  training_state TEXT,
  injuries TEXT,
  days_per_week INTEGER DEFAULT 3,
  commitment_answer TEXT,
  body_weight_kg DECIMAL(5,2),
  protein_target INTEGER DEFAULT 160,
  calorie_target INTEGER DEFAULT 2200,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Programme state
CREATE TABLE IF NOT EXISTS programme_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  current_day INTEGER DEFAULT 1,
  current_week INTEGER DEFAULT 1,
  start_date DATE DEFAULT CURRENT_DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily check-ins
CREATE TABLE IF NOT EXISTS check_ins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
  morning_energy INTEGER CHECK (morning_energy BETWEEN 1 AND 5),
  stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 5),
  soreness INTEGER CHECK (soreness BETWEEN 1 AND 5),
  motivation INTEGER CHECK (motivation BETWEEN 1 AND 5),
  notes TEXT,
  edge_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Training sessions
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('push', 'squat', 'pull')),
  session_number INTEGER,
  completed_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exercise logs (within sessions)
CREATE TABLE IF NOT EXISTS exercise_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  sets_completed INTEGER DEFAULT 0,
  reps INTEGER,
  weight_kg DECIMAL(5,2),
  struggled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edge AI chat messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STRONG System lesson completions
CREATE TABLE IF NOT EXISTS lesson_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL CHECK (day_number BETWEEN 1 AND 30),
  cycle INTEGER NOT NULL DEFAULT 1 CHECK (cycle BETWEEN 1 AND 3),
  reflection TEXT,
  micro_action_done BOOLEAN DEFAULT false,
  end_of_day_score INTEGER CHECK (end_of_day_score BETWEEN 1 AND 10),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, day_number, cycle)
);

-- Sleep logs
CREATE TABLE IF NOT EXISTS sleep_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  bedtime TIME,
  wake_time TIME,
  quality INTEGER CHECK (quality BETWEEN 1 AND 10),
  duration_hours DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Admin notes (Nick's notes visible to Edge)
CREATE TABLE IF NOT EXISTS admin_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by TEXT DEFAULT 'Nick',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sleep_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Programme state
CREATE POLICY "Users can manage own programme" ON programme_state FOR ALL USING (auth.uid() = user_id);

-- Check-ins
CREATE POLICY "Users can manage own check-ins" ON check_ins FOR ALL USING (auth.uid() = user_id);

-- Training sessions
CREATE POLICY "Users can manage own sessions" ON training_sessions FOR ALL USING (auth.uid() = user_id);

-- Exercise logs
CREATE POLICY "Users can manage own exercise logs" ON exercise_logs FOR ALL USING (auth.uid() = user_id);

-- Messages
CREATE POLICY "Users can manage own messages" ON messages FOR ALL USING (auth.uid() = user_id);

-- Lesson completions
CREATE POLICY "Users can manage own lessons" ON lesson_completions FOR ALL USING (auth.uid() = user_id);

-- Sleep logs
CREATE POLICY "Users can manage own sleep" ON sleep_logs FOR ALL USING (auth.uid() = user_id);

-- Admin notes (readable by owner, writable by service role only)
CREATE POLICY "Users can read own admin notes" ON admin_notes FOR SELECT USING (auth.uid() = user_id);

-- =====================
-- FUNCTIONS & TRIGGERS
-- =====================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- =====================
-- MIGRATION: Nutrition targets (run if upgrading from earlier schema)
-- =====================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_weight_kg DECIMAL(5,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS protein_target INTEGER DEFAULT 160;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS calorie_target INTEGER DEFAULT 2200;

-- =====================
-- Per-client programmes (migration 0002)
-- =====================
CREATE TABLE IF NOT EXISTS client_programmes (
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  programme  JSONB NOT NULL,
  sessions   JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE client_programmes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own programme" ON client_programmes;
CREATE POLICY "Users can read own programme"
  ON client_programmes FOR SELECT
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS client_programmes_updated_at ON client_programmes;
CREATE TRIGGER client_programmes_updated_at
  BEFORE UPDATE ON client_programmes
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- =====================
-- Hero Meals (migration 0003) — client-starred recipes, used to build shopping lists
-- =====================
CREATE TABLE IF NOT EXISTS hero_meals (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  recipe_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, recipe_id)
);

ALTER TABLE hero_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own hero meals" ON hero_meals;
CREATE POLICY "Users can manage own hero meals"
  ON hero_meals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
