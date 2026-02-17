
-- Enum for app roles
CREATE TYPE public.app_role AS ENUM ('admin', 'master', 'player');

-- Enum for races
CREATE TYPE public.character_race AS ENUM (
  'Humano', 'Elfo', 'Anão', 'Fada', 'Homem Réptil', 
  'Draconiano', 'Orc', 'Ogro', 'Besta', 'Elemental'
);

-- Enum for classes
CREATE TYPE public.character_class AS ENUM (
  'Guerreiro', 'Assassino', 'Paladino', 'Monge', 'Arqueiro',
  'Engenheiro', 'Mago', 'Feiticeiro', 'Bruxo', 'Necromante',
  'Xamã', 'Bárbaro', 'Caçador', 'Pirata/Ladrão', 'Cavaleiro'
);

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'player',
  UNIQUE(user_id, role)
);

-- Game tables (mesas)
CREATE TABLE public.game_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  max_level INTEGER NOT NULL DEFAULT 20,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_turn_character_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table memberships
CREATE TABLE public.table_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.game_tables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'player',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(table_id, user_id)
);

-- Character sheets
CREATE TABLE public.character_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.game_tables(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age TEXT,
  height TEXT,
  race character_race,
  class character_class,
  level INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  history TEXT,
  -- Health
  hit_points INTEGER NOT NULL DEFAULT 10,
  constitution INTEGER NOT NULL DEFAULT 10,
  mana INTEGER NOT NULL DEFAULT 10,
  -- Treasures
  gold INTEGER NOT NULL DEFAULT 0,
  silver INTEGER NOT NULL DEFAULT 0,
  copper INTEGER NOT NULL DEFAULT 0,
  -- Attributes
  strength INTEGER NOT NULL DEFAULT 0,
  defense INTEGER NOT NULL DEFAULT 0,
  resistance INTEGER NOT NULL DEFAULT 0,
  intelligence INTEGER NOT NULL DEFAULT 0,
  wisdom INTEGER NOT NULL DEFAULT 0,
  stealth INTEGER NOT NULL DEFAULT 0,
  reflexes INTEGER NOT NULL DEFAULT 0,
  charisma INTEGER NOT NULL DEFAULT 0,
  -- Skills
  light_cutting_weapons INTEGER NOT NULL DEFAULT 0,
  heavy_cutting_weapons INTEGER NOT NULL DEFAULT 0,
  short_bows INTEGER NOT NULL DEFAULT 0,
  long_bows INTEGER NOT NULL DEFAULT 0,
  spears INTEGER NOT NULL DEFAULT 0,
  armor INTEGER NOT NULL DEFAULT 0,
  horses INTEGER NOT NULL DEFAULT 0,
  traps INTEGER NOT NULL DEFAULT 0,
  potions INTEGER NOT NULL DEFAULT 0,
  others INTEGER NOT NULL DEFAULT 0,
  -- Equipment slots
  left_hand TEXT,
  right_hand TEXT,
  boots TEXT,
  back TEXT,
  torso TEXT,
  legs TEXT,
  belt TEXT,
  -- Backpack
  backpack_max_load INTEGER NOT NULL DEFAULT 10,
  backpack_items TEXT[] DEFAULT '{}',
  -- Mount
  mount_name TEXT,
  mount_max_load INTEGER NOT NULL DEFAULT 5,
  mount_items TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invitations
CREATE TABLE public.table_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.game_tables(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK for current turn
ALTER TABLE public.game_tables 
ADD CONSTRAINT fk_current_turn 
FOREIGN KEY (current_turn_character_id) 
REFERENCES public.character_sheets(id) ON DELETE SET NULL;

-- SECURITY DEFINER FUNCTIONS

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_table_member(_table_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.table_memberships
    WHERE table_id = _table_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_table_master(_table_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.table_memberships
    WHERE table_id = _table_id AND user_id = auth.uid() AND role = 'master'
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'player');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_invitations ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
CREATE POLICY "Anyone authenticated can view profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- USER ROLES POLICIES
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- GAME TABLES POLICIES
CREATE POLICY "Members can view tables"
  ON public.game_tables FOR SELECT TO authenticated
  USING (public.is_table_member(id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Masters and admins can create tables"
  ON public.game_tables FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'master') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Table master can update"
  ON public.game_tables FOR UPDATE TO authenticated
  USING (public.is_table_master(id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Table master can delete"
  ON public.game_tables FOR DELETE TO authenticated
  USING (public.is_table_master(id) OR public.has_role(auth.uid(), 'admin'));

-- TABLE MEMBERSHIPS POLICIES
CREATE POLICY "Members can view memberships"
  ON public.table_memberships FOR SELECT TO authenticated
  USING (public.is_table_member(table_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Masters can add members"
  ON public.table_memberships FOR INSERT TO authenticated
  WITH CHECK (
    public.is_table_master(table_id) OR public.has_role(auth.uid(), 'admin')
    OR user_id = auth.uid()
  );

CREATE POLICY "Masters can remove members"
  ON public.table_memberships FOR DELETE TO authenticated
  USING (public.is_table_master(table_id) OR user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- CHARACTER SHEETS POLICIES
CREATE POLICY "Table members can view sheets"
  ON public.character_sheets FOR SELECT TO authenticated
  USING (public.is_table_member(table_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Players can create own sheets"
  ON public.character_sheets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_table_member(table_id));

CREATE POLICY "Owner or master can update sheets"
  ON public.character_sheets FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_table_master(table_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or master can delete sheets"
  ON public.character_sheets FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_table_master(table_id) OR public.has_role(auth.uid(), 'admin'));

-- INVITATIONS POLICIES
CREATE POLICY "Masters can manage invitations"
  ON public.table_invitations FOR ALL TO authenticated
  USING (public.is_table_master(table_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone authenticated can view invitation by token"
  ON public.table_invitations FOR SELECT TO authenticated
  USING (true);

-- Enable realtime for game tables and character sheets
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.character_sheets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_memberships;
