import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { mensagem, supabase } from "./src/supabase";
import { cor } from "./src/tema";
import { Botao, Entrar } from "./src/telas/Entrar";
import { Principal } from "./src/telas/Principal";

/* App do motorista e do agregado da Prisa. Depois do login, ativar_acesso_app liga o celular verificado ao
   cadastro do motorista (a operação libera o celular na ficha dele, no sistema). */
export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [acesso, setAcesso] = useState<"verificando" | "ok" | string>("verificando");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessao) return;
    setAcesso("verificando");
    supabase.rpc("ativar_acesso_app").then(({ error }) => setAcesso(error ? mensagem(error) : "ok"));
  }, [sessao?.user.id]);

  return (
    <>
      <StatusBar style="dark" />
      {sessao === undefined || (sessao && acesso === "verificando") ? (
        <View style={s.centro}>
          <ActivityIndicator size="large" color={cor.verde} />
        </View>
      ) : !sessao ? (
        <Entrar />
      ) : acesso === "ok" ? (
        <Principal />
      ) : (
        <View style={s.centro}>
          <Text style={s.titulo}>Sem acesso ao app</Text>
          <Text style={s.texto}>{acesso}</Text>
          <Botao texto="Voltar" tipo="secundario" onPress={() => supabase.auth.signOut()} />
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, backgroundColor: cor.fundo, justifyContent: "center", padding: 24 },
  titulo: { fontSize: 22, fontWeight: "700", color: cor.tinta, marginBottom: 8 },
  texto: { fontSize: 15, color: cor.apagado, marginBottom: 20, lineHeight: 21 },
});
