import { type User } from "jsr:@supabase/supabase-js@2";
import { supabaseAdmin } from "./supabaseAdmin.ts";

/**
 * Get the user record associated to the provided auth user.
 */
export const getUserSale = async (user: User) => {
  return (
    await supabaseAdmin
      .from("users")
      .select("*")
      .eq("user_id", user.id)
      .single()
  )?.data;
};
