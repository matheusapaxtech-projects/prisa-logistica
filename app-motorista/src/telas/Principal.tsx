import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { mensagem, supabase, type Cadastro, type Frete, type Pendencia } from "../supabase";
import { cor, dia, quando, reais } from "../tema";
import { Botao } from "./Entrar";

const PRAZOS = [
  { rotulo: "12 horas", horas: 12 },
  { rotulo: "1 dia", horas: 24 },
  { rotulo: "2 dias", horas: 48 },
  { rotulo: "3 dias", horas: 72 },
];

/* Tela principal: "Estou livre" (posição do GPS), o que falta para ser contratado e os fretes em que ele
   pode entrar, com o frete dele. "Tenho interesse" só avisa a operação. */
export function Principal() {
  const [cad, setCad] = useState<Cadastro | null>(null);
  const [pend, setPend] = useState<Pendencia[]>([]);
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [escolherPrazo, setEscolherPrazo] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [c, p, f] = await Promise.all([supabase.rpc("meu_cadastro"), supabase.rpc("minhas_pendencias"), supabase.rpc("fretes_para_mim")]);
      for (const r of [c, p, f]) if (r.error) throw r.error;
      setCad(c.data as Cadastro);
      setPend((p.data ?? []) as Pendencia[]);
      setFretes((f.data ?? []) as Frete[]);
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function acao(chave: string, f: () => Promise<void>) {
    setErro(null);
    setOcupado(chave);
    try {
      await f();
      await carregar();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(null);
    }
  }

  const estouLivre = (horas: number) =>
    acao("checkin", async () => {
      setEscolherPrazo(false);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") throw new Error("Libere a localização para a Prisa achar os fretes perto de você.");
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = pos.coords;
      if (latitude < -35 || latitude > 6 || longitude < -75 || longitude > -28) throw new Error("Sua localização está fora do Brasil.");
      const [lugar] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
      const cidade = lugar ? [lugar.city ?? lugar.subregion, lugar.region].filter(Boolean).join("/") : "Localização do GPS";
      const { error } = await supabase.rpc("registrar_checkin", {
        p_cidade: cidade || "Localização do GPS",
        p_latitude: Number(latitude.toFixed(6)),
        p_longitude: Number(longitude.toFixed(6)),
        p_livre_ate: new Date(Date.now() + horas * 36e5).toISOString(),
      });
      if (error) throw error;
    });

  const naoEstouLivre = () =>
    acao("checkin", async () => {
      const { error } = await supabase.rpc("encerrar_checkin");
      if (error) throw error;
    });

  const interesse = (f: Frete) =>
    acao(f.oferta_id, async () => {
      const { error } = await supabase.rpc(f.tenho_interesse ? "desistir_interesse" : "registrar_interesse", { p_oferta: f.oferta_id });
      if (error) throw error;
    });

  const travas = pend.filter((p) => p.nivel !== "aviso" && p.codigo !== "sem_checkin");
  const nome = cad?.apelido || cad?.nome?.split(" ")[0] || "motorista";

  return (
    <ScrollView style={s.tela} contentContainerStyle={s.conteudo} refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} />}>
      <View style={s.topo}>
        <View>
          <Text style={s.ola}>Olá, {nome}</Text>
          {cad?.conjunto && (
            <Text style={s.sub}>
              {cad.conjunto.cavalo} · {cad.conjunto.eixos} eixos
            </Text>
          )}
        </View>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={s.sair}>Sair</Text>
        </Pressable>
      </View>

      {erro && <Text style={s.erro}>{erro}</Text>}

      <View style={[s.cartao, cad?.checkin ? s.cartaoLivre : null]}>
        {cad?.checkin ? (
          <>
            <Text style={s.cartaoTitulo}>Você está livre</Text>
            <Text style={s.texto}>
              Em {cad.checkin.cidade}, até {quando(cad.checkin.livre_ate)}. A Prisa vê que você está disponível.
            </Text>
            <Botao texto="Não estou mais livre" tipo="secundario" onPress={naoEstouLivre} ocupado={ocupado === "checkin"} />
          </>
        ) : (
          <>
            <Text style={s.cartaoTitulo}>Está livre para carregar?</Text>
            <Text style={s.texto}>Avise e veja os fretes perto de você. Usamos a sua localização só agora, ao tocar no botão.</Text>
            {escolherPrazo ? (
              <View style={s.prazos}>
                {PRAZOS.map((p) => (
                  <Pressable key={p.horas} style={s.prazo} onPress={() => estouLivre(p.horas)}>
                    <Text style={s.prazoTexto}>{p.rotulo}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Botao texto="Estou livre" onPress={() => setEscolherPrazo(true)} ocupado={ocupado === "checkin"} />
            )}
          </>
        )}
      </View>

      {travas.length > 0 && (
        <View style={[s.cartao, s.cartaoPend]}>
          <Text style={[s.cartaoTitulo, { color: cor.amareloTinta }]}>Para ser contratado, falta resolver</Text>
          {travas.map((p) => (
            <Text key={p.codigo} style={s.pend}>
              • {p.mensagem}
            </Text>
          ))}
          <Text style={[s.texto, { marginBottom: 0 }]}>Fale com a operação da Prisa para regularizar.</Text>
        </View>
      )}

      <Text style={s.secao}>Fretes para você {fretes.length > 0 ? `(${fretes.length})` : ""}</Text>
      {fretes.length === 0 && !carregando && (
        <Text style={s.vazio}>
          {cad?.checkin ? "Nenhum frete perto de você agora. Puxe para baixo para atualizar." : "Avise que está livre para ver os fretes."}
        </Text>
      )}
      {fretes.map((f) => (
        <View key={f.oferta_id} style={s.frete}>
          <Text style={s.rota}>
            {f.coleta_cidade}/{f.coleta_uf} → {f.descarga_cidade}/{f.descarga_uf}
          </Text>
          <Text style={s.valor}>{reais(f.frete_motorista_por_t)}/t</Text>
          <Text style={s.detalhe}>
            {f.produto} · {f.saldo_t.toLocaleString("pt-BR")} t · coleta {dia(f.coleta_prevista)}
          </Text>
          <Text style={s.detalhe}>A {f.km_ate_embarque} km de você até a coleta</Text>
          {f.observacao && <Text style={s.recado}>{f.observacao}</Text>}
          <View style={{ marginTop: 12 }}>
            {f.tenho_interesse ? (
              <>
                <Text style={s.interesse}>✓ A Prisa sabe que você tem interesse. Aguarde o contato da operação.</Text>
                <Botao texto="Desistir" tipo="secundario" onPress={() => interesse(f)} ocupado={ocupado === f.oferta_id} />
              </>
            ) : (
              <Botao texto="Tenho interesse" onPress={() => interesse(f)} ocupado={ocupado === f.oferta_id} />
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: 16, paddingTop: 56, paddingBottom: 40 },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  ola: { fontSize: 26, fontWeight: "800", color: cor.tinta },
  sub: { fontSize: 14, color: cor.apagado, marginTop: 2 },
  sair: { color: cor.verde, fontWeight: "700", fontSize: 15, padding: 6 },
  cartao: { backgroundColor: cor.folha, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: cor.borda, marginBottom: 14 },
  cartaoLivre: { backgroundColor: cor.verdeClaro, borderColor: "#b9d0c2" },
  cartaoPend: { backgroundColor: cor.amareloClaro, borderColor: "#b8901a" },
  cartaoTitulo: { fontSize: 18, fontWeight: "700", color: cor.tinta, marginBottom: 6 },
  texto: { fontSize: 15, color: cor.apagado, lineHeight: 21, marginBottom: 12 },
  prazos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  prazo: { backgroundColor: cor.verde, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, flexGrow: 1, alignItems: "center" },
  prazoTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
  pend: { fontSize: 15, color: cor.amareloTinta, marginBottom: 6, lineHeight: 21 },
  secao: { fontSize: 18, fontWeight: "800", color: cor.tinta, marginTop: 8, marginBottom: 10 },
  vazio: { fontSize: 15, color: cor.apagado, lineHeight: 21 },
  frete: { backgroundColor: cor.folha, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: cor.borda, marginBottom: 12 },
  rota: { fontSize: 18, fontWeight: "800", color: cor.tinta },
  valor: { fontSize: 24, fontWeight: "800", color: cor.verde, marginVertical: 6 },
  detalhe: { fontSize: 14, color: cor.apagado, lineHeight: 20 },
  recado: { fontSize: 14, color: cor.azulTinta, backgroundColor: cor.azulClaro, padding: 10, borderRadius: 8, marginTop: 8 },
  interesse: { fontSize: 14, color: cor.verdeTinta, marginBottom: 10, lineHeight: 20 },
  erro: { color: cor.vermelhoTinta, backgroundColor: cor.vermelhoClaro, padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 14 },
});
