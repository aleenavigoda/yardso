/*
  # Create automatic profile creation trigger

  1. New Functions
    - `handle_new_user()` - Automatically creates a profile when a new user signs up
  
  2. Triggers
    - Trigger on auth.users insert to create profile automatically
  
  3. Security
    - Function runs with security definer privileges to bypass RLS during profile creation
*/

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(split_part(NEW.raw_user_meta_data->>'full_name', ' ', 1), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();