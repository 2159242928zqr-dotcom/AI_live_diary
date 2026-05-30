import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import { Session, User } from "@supabase/supabase-js";
import { apiPost } from "./api";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, inviteCode?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false); // 网络失败也不锁死界面
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const register = async (email: string, password: string, inviteCode?: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error("注册失败");

    // 同步 profile 到后端
    try {
      await apiPost("/api/auth/profile", {
        userId: data.user.id,
        email,
        inviteCode: generateInviteCode(),
        usedInviteCode: inviteCode,
      });
    } catch (syncError) {
      console.warn("后端 profile 同步失败:", syncError);
      // 虽然同步失败了，但用户实际上已经在 Supabase Auth 注册成功，可以继续使用
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

function generateInviteCode() {
  return `MV-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
