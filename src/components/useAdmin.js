/* ====================================================================
   useAdmin — the "ultimate admin" gate (optional)
   --------------------------------------------------------------------
   React binding over the admin-auth helpers in lib/supabase.js. When
   Supabase isn't configured, `configured` is false and `ready` is true
   at once, and App leaves the host UI fully open (offline/LAN use). When
   configured, the host surfaces (build/start/host a room) are shown only
   to a signed-in admin — a real email/password auth user on the server
   allow-list (public.admins). Players never see any of this; their join
   flow is untouched. Never throws — failures degrade to "not an admin".
   ==================================================================== */

import { useCallback, useEffect, useState } from "react";
import {
  isSupabaseConfigured,
  getAuthUser,
  signInAdmin,
  signUpAdmin,
  signOutAdmin,
  isAdmin as checkIsAdmin,
  claimFirstAdmin,
  grantAdmin as grantAdminRpc,
} from "../lib/supabase.js";

export function useAdmin() {
  const [configured] = useState(isSupabaseConfigured);
  const [ready, setReady] = useState(!isSupabaseConfigured); // unconfigured → ready at once
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState(null); // the signed-in admin email (null = anon/none)

  // Re-read the current auth user + admin status from the server.
  const refresh = useCallback(async () => {
    const user = await getAuthUser();
    const mail = user?.email || null; // anonymous sessions have no email
    setEmail(mail);
    const admin = mail ? await checkIsAdmin() : false;
    setIsAdmin(admin);
    return admin;
  }, []);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    (async () => {
      await refresh();
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [configured, refresh]);

  /** Sign in with email/password, then re-check admin status. Returns { signedIn, isAdmin }. */
  const signIn = useCallback(
    async (mail, pw) => {
      const user = await signInAdmin(mail, pw);
      if (!user) return { signedIn: false, isAdmin: false };
      const admin = await refresh();
      return { signedIn: true, isAdmin: admin };
    },
    [refresh],
  );

  /** First-time setup: create the auth account (may need email confirmation). Returns the user or null. */
  const signUp = useCallback(async (mail, pw) => signUpAdmin(mail, pw), []);

  /** Sign out and return the device to an anonymous player session. */
  const signOut = useCallback(async () => {
    await signOutAdmin();
    setEmail(null);
    setIsAdmin(false);
  }, []);

  /** Claim the protected ultimate-admin slot (only works while the allow-list is empty). */
  const claimFirst = useCallback(async () => {
    const ok = await claimFirstAdmin();
    if (ok) await refresh();
    return ok;
  }, [refresh]);

  /** Admin-only: add another admin by email. Returns true on success. */
  const grantAdmin = useCallback(async (mail) => grantAdminRpc(mail), []);

  return { configured, ready, isAdmin, email, signIn, signUp, signOut, claimFirst, grantAdmin, refresh };
}
