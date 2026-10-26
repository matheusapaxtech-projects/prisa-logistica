import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { desligarEnvio, enviarPosicaoAgora, estadoLocalizacao, ligarEnvio, type EstadoLocalizacao } from "./src/localizacao";
import { mensagem, supabase } from "./src/supabase";
import { cor } from "./src/tema";
import { Botao, Entrar } from "./src/telas/Entrar";
import { PermitirLocalizacao } from "./src/telas/PermitirLocalizacao";
import { Principal } from "./src/telas/Principal";

/* App do motorista e do agregado da Prisa. Depois do login, ativar_acesso_app liga o celular verificado ao
   cadastro do motorista (a operação libera o celular na ficha dele, no sistema). */
export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [acesso, setAcesso] = useState<"verificando" | "ok" | string>("verificando");
  // Localização: null = ainda conferindo; o aviso aparece uma vez por abertura enquanto não estiver ativa.
  const [local, setLocal] = useState<EstadoLocalizacao | null>(null);
  const [avisoVisto, setAvisoVisto] = useState(false);

  // INITIAL_SESSION chega ao assinar; ativar_acesso_app roda ao abrir e ao entrar (não a cada renovação do login).
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s);
      if (s && (evento === "INITIAL_SESSION" || evento === "SIGNED_IN")) {
        setAcesso("verificando");
        supabase.rpc("ativar_acesso_app").then(({ error }) => setAcesso(error ? mensagem(error) : "ok"));
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (acesso !== "ok") return;
    (async () => {
      await ligarEnvio().catch(() => undefined);
      setLocal(await estadoLocalizacao().catch((): EstadoLocalizacao => "indisponivel"));
      enviarPosicaoAgora().catch(() => undefined);
    })();
  }, [acesso]);

  const sair = async () => {
    await desligarEnvio().catch(() => undefined);
    await supabase.auth.signOut();
  };

  return (
    <>
      <StatusBar style="dark" />
      {sessao === undefined || (sessao && (acesso === "verificando" || (acesso === "ok" && local === null))) ? (
        <View style={s.centro}>
          <ActivityIndicator size="large" color={cor.verde} />
        </View>
      ) : !sessao ? (
        <Entrar />
      ) : acesso === "ok" && local !== "ativa" && !avisoVisto ? (
        <PermitirLocalizacao
          estado={local!}
          aoTerminar={(e) => {
            setLocal(e);
            setAvisoVisto(true);
          }}
        />
      ) : acesso === "ok" ? (
        <Principal localizacao={local!} aoPedirLocalizacao={() => setAvisoVisto(false)} aoSair={sair} />
      ) : (
        <View style={s.centro}>
          <Text style={s.titulo}>Sem acesso ao app</Text>
          <Text style={s.texto}>{acesso}</Text>
          <Botao texto="Voltar" tipo="secundario" onPress={sair} />
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
