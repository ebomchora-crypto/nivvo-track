import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

async function entrar(fd: FormData) {
  "use server";
  const { error } = await supabaseServer().auth.signInWithPassword({ email: String(fd.get("email")), password: String(fd.get("senha")) });
  if (error) redirect("/login?erro=1");
  redirect("/");
}

export default function Login({ searchParams }: { searchParams: { erro?: string } }) {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form action={entrar} className="w-full max-w-sm space-y-4 border border-white/20 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">NivvoTrack</h1>
        <input name="email" type="email" required placeholder="E-mail" className="w-full bg-black border border-white/30 p-2" />
        <input name="senha" type="password" required placeholder="Senha" className="w-full bg-black border border-white/30 p-2" />
        {searchParams.erro && <p className="text-sm">E-mail ou senha inválidos.</p>}
        <button className="w-full bg-white text-black p-2 font-medium">Entrar</button>
      </form>
    </main>
  );
}
