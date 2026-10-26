import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { Check, FileText, House, MapPin, Truck } from "lucide-react-native";
import { enviarPosicaoAgora, type EstadoLocalizacao } from "../localizacao";
import { mensagem, supabase, type Cadastro, type Frete, type Pendencia } from "../supabase";
import { CARROCERIA, cor, diaDoPedido, faltaAte, fimDoPrazo, fonte, haQuanto, numeros, reais, saudacao, sombra } from "../tema";
import { Aviso, Forma, Fundo, Pilula, Placa, Sinal, Vidro } from "../ui";

const PRAZOS = [
  { rotulo: "12 horas", horas: 12 },
  { rotulo: "1 dia", horas: 24 },
  { rotulo: "2 dias", horas: 48 },
  { rotulo: "3 dias", horas: 72 },
];

type Dados = { cad: Cadastro; pend: Pendencia[]; fretes: Frete[] };

/** Cadastro, pendências e fretes do motorista logado (funções do app no banco). */
async function buscar(): Promise<Dados> {
  const [c, p, f] = await Promise.all([supabase.rpc("meu_cadastro"), supabase.rpc("minhas_pendencias"), supabase.rpc("fretes_para_mim")]);
  for (const r of [c, p, f]) if (r.error) throw r.error;
  return { cad: c.data as Cadastro, pend: (p.data ?? []) as Pendencia[], fretes: (f.data ?? []) as Frete[] };
}

type Props = { localizacao: EstadoLocalizacao; aoPedirLocalizacao: () => void; aoSair: () => void };

/* Início: o cartão de situação ("Estou livre") no centro, o que falta para ser contratado em laranja e os fretes
   em que ele pode entrar, com o frete dele e a rota desenhada. "Tenho interesse" só avisa a operação. */
export function Principal({ localizacao, aoPedirLocalizacao, aoSair }: Props) {
  const [cad, setCad] = useState<Cadastro | null>(null);
  const [pend, setPend] = useState<Pendencia[]>([]);
  const [fretes, setFretes] = useState<Frete[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [prazoAberto, setPrazoAberto] = useState(false);
  const [prazo, setPrazo] = useState(48);
  // Hora em que a janela de prazos abriu: base do "até…" de cada prazo.
  const [abertoEm, setAbertoEm] = useState(0);

  const aplicar = useCallback((d: Dados) => {
    setCad(d.cad);
    setPend(d.pend);
    setFretes(d.fretes);
    setErro(null);
    setCarregando(false);
  }, []);
  const falhar = useCallback((e: unknown) => {
    setErro(mensagem(e));
    setCarregando(false);
  }, []);
  const carregar = useCallback(() => buscar().then(aplicar, falhar), [aplicar, falhar]);

  useEffect(() => {
    buscar().then(aplicar, falhar);
  }, [aplicar, falhar]);

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

  const estouLivre = () =>
    acao("checkin", async () => {
      setPrazoAberto(false);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") throw new Error("Libere a localização para a Prisa achar os fretes perto de você.");
      const pos = (await enviarPosicaoAgora()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));
      const { latitude, longitude } = pos.coords;
      if (latitude < -35 || latitude > 6 || longitude < -75 || longitude > -28) throw new Error("Sua localização está fora do Brasil.");
      const [lugar] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
      const cidade = lugar ? [lugar.city ?? lugar.subregion, lugar.region].filter(Boolean).join("/") : "";
      const { error } = await supabase.rpc("registrar_checkin", {
        p_cidade: cidade || "Localização do GPS",
        p_latitude: Number(latitude.toFixed(6)),
        p_longitude: Number(longitude.toFixed(6)),
        p_livre_ate: new Date(Date.now() + prazo * 36e5).toISOString(),
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
  const iniciais = (cad?.nome ?? "M").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const cj = cad?.conjunto;
  const carroceria = cj?.carrocerias?.length ? cj.carrocerias.map((c) => CARROCERIA[c] ?? c).join(", ") : null;

  return (
    <Fundo>
      <ScrollView
        contentContainerStyle={s.conteudo}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} tintColor={cor.tinta} />}
      >
        <View style={s.topo}>
          <View style={{ flex: 1 }}>
            <Text style={s.ola}>
              {saudacao()}, {nome}
            </Text>
            {cj && (
              <View style={s.veiculo}>
                <Placa placa={cj.cavalo} />
                <Text style={s.veiculoTexto}>
                  {cj.eixos} eixos{carroceria ? `, ${carroceria}` : ""}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={() => Alert.alert(cad?.nome ?? "Motorista", "Sair do app desliga o envio da sua localização.", [{ text: "Voltar" }, { text: "Sair", style: "destructive", onPress: aoSair }])}
            style={s.avatar}
            accessibilityRole="button"
            accessibilityLabel="Sua conta e sair"
          >
            <Text style={s.avatarTexto}>{iniciais}</Text>
          </Pressable>
        </View>

        {erro && (
          <View style={{ marginBottom: 14 }}>
            <Aviso tipo="erro" texto={erro} />
          </View>
        )}

        {localizacao !== "ativa" && (
          <Pressable onPress={aoPedirLocalizacao} style={{ marginBottom: 14 }} accessibilityRole="button">
            <Aviso tipo="pendente" titulo="Localização desligada" texto="Sem ela a Prisa não te encontra para os fretes perto. Toque para ligar." />
          </Pressable>
        )}

        {cad?.checkin ? (
          <View style={[s.situacao, s.livre]}>
            <View style={s.formaCanto}>
              <Forma tipo="normal" cor="#fff" />
            </View>
            <Text style={[s.situacaoTitulo, { color: "#fff" }]}>Você está livre</Text>
            <View style={s.ate}>
              <Text style={[s.ateNumero, numeros]}>{faltaAte(cad.checkin.livre_ate)}</Text>
              <Text style={s.ateTexto}>até {fimDoPrazo(new Date(cad.checkin.livre_ate))}</Text>
            </View>
            <View style={s.onde}>
              <MapPin size={16} color="#fff" strokeWidth={1.8} />
              <Text style={s.ondeTexto}>
                {cad.checkin.cidade}, avisado {haQuanto(cad.checkin.em)}
              </Text>
            </View>
            <Pilula texto="Não estou mais livre" tipo="clara" onPress={naoEstouLivre} ocupado={ocupado === "checkin"} />
          </View>
        ) : (
          <View style={[s.situacao, s.parado]}>
            <Text style={[s.situacaoTitulo, { color: cor.folha }]}>Está livre para carregar?</Text>
            <Text style={s.paradoTexto}>Avise a Prisa e veja os fretes perto de onde você está.</Text>
            <Pilula texto="Estou livre" tipo="clara" onPress={() => {
                setAbertoEm(Date.now());
                setPrazoAberto(true);
              }} ocupado={ocupado === "checkin"} />
          </View>
        )}

        {travas.length > 0 && (
          <View style={s.falta}>
            <View style={s.faltaCab}>
              <Forma tipo="pendente" />
              <Text style={s.faltaTitulo}>Falta resolver para ser contratado</Text>
            </View>
            {travas.map((p) => (
              <Text key={p.codigo} style={s.faltaItem}>
                {p.mensagem}
              </Text>
            ))}
            <Text style={s.faltaNota}>Fale com a operação da Prisa para regularizar.</Text>
          </View>
        )}

        <View style={s.secao}>
          <Text style={s.secaoTitulo}>Fretes para você</Text>
          {fretes.length > 0 && <Text style={s.secaoConta}>{fretes.length === 1 ? "1 perto" : `${fretes.length} perto`}</Text>}
        </View>

        {fretes.length === 0 && !carregando && (
          <View style={s.vazio}>
            <Text style={s.vazioTexto}>
              {cad?.checkin ? "Nenhum frete perto de você agora. Puxe a tela para baixo para atualizar." : "Avise que está livre para ver os fretes perto de você."}
            </Text>
          </View>
        )}

        {fretes.map((f) => (
          <Vidro key={f.oferta_id} style={s.frete}>
            <View style={s.freteCab}>
              <View style={{ flex: 1 }}>
                <Text style={[s.valor, numeros]}>
                  {reais(f.frete_motorista_por_t)}
                  <Text style={s.valorUnidade}>/t</Text>
                </Text>
                <Text style={s.valorSub}>seu frete, {f.saldo_t.toLocaleString("pt-BR")} t a carregar</Text>
              </View>
              <Sinal tipo="info" texto={`${f.km_ate_embarque} km`} />
            </View>

            <View style={s.rota}>
              <View style={s.trilho}>
                <View style={s.pontoInicio} />
                <View style={s.estrada}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <View key={i} style={s.faixa} />
                  ))}
                </View>
                <View style={s.pontoFim} />
              </View>
              <View style={{ flex: 1, gap: 16 }}>
                <View>
                  <Text style={s.cidade}>
                    {f.coleta_cidade}/{f.coleta_uf}
                  </Text>
                  <Text style={s.quando}>coleta {diaDoPedido(f.coleta_prevista)}</Text>
                </View>
                <View>
                  <Text style={s.cidade}>
                    {f.descarga_cidade}/{f.descarga_uf}
                  </Text>
                  <Text style={s.quando}>{f.entrega_prevista ? `entrega até ${diaDoPedido(f.entrega_prevista)}` : "entrega a combinar"}</Text>
                </View>
              </View>
            </View>

            <View style={s.fatos}>
              <Text style={s.fato}>{f.produto}</Text>
              <Text style={s.fato}>a {f.km_ate_embarque} km de você</Text>
            </View>

            {f.observacao && (
              <View style={s.recado}>
                <Forma tipo="info" />
                <Text style={s.recadoTexto}>{f.observacao}</Text>
              </View>
            )}

            {f.tenho_interesse ? (
              <>
                <View style={s.ja}>
                  <Check size={22} color={cor.verde} strokeWidth={2.4} />
                  <Text style={s.jaTexto}>A operação recebeu seu interesse e vai te chamar no WhatsApp se você for o escolhido.</Text>
                </View>
                <Pilula texto="Desistir deste frete" tipo="texto" onPress={() => interesse(f)} ocupado={ocupado === f.oferta_id} />
              </>
            ) : (
              <Pilula texto="Tenho interesse" onPress={() => interesse(f)} ocupado={ocupado === f.oferta_id} />
            )}
          </Vidro>
        ))}
      </ScrollView>

      <View style={s.menu}>
        <View style={[s.menuItem, s.menuAtual]}>
          <House size={22} color={cor.tinta} strokeWidth={1.8} />
          <Text style={[s.menuTexto, { color: cor.tinta, ...fonte(600) }]}>Início</Text>
        </View>
        <Pressable style={s.menuItem} onPress={() => Alert.alert("Minhas viagens", "Em breve: as suas viagens com a Prisa aparecem aqui.")}>
          <Truck size={22} color={cor.noiteTexto} strokeWidth={1.8} />
          <Text style={s.menuTexto}>Minhas viagens</Text>
        </Pressable>
        <Pressable style={s.menuItem} onPress={() => Alert.alert("Documentos", "Em breve: envie e acompanhe os seus documentos por aqui.")}>
          <FileText size={22} color={cor.noiteTexto} strokeWidth={1.8} />
          {travas.length > 0 && (
            <View style={s.menuConta}>
              <Text style={s.menuContaTexto}>{travas.length}</Text>
            </View>
          )}
          <Text style={s.menuTexto}>Documentos</Text>
        </Pressable>
      </View>

      <Modal visible={prazoAberto} transparent animationType="slide" onRequestClose={() => setPrazoAberto(false)}>
        <Pressable style={s.veu} onPress={() => setPrazoAberto(false)} accessibilityLabel="Fechar" />
        <View style={s.folha}>
          <View style={s.alca} />
          <Text style={s.folhaTitulo}>Livre por quanto tempo?</Text>
          <Text style={s.folhaTexto}>Depois desse prazo a Prisa para de te mostrar como disponível.</Text>
          <View style={s.prazos}>
            {PRAZOS.map((p) => {
              const marcado = p.horas === prazo;
              return (
                <Pressable
                  key={p.horas}
                  onPress={() => setPrazo(p.horas)}
                  style={[s.prazo, marcado && s.prazoMarcado]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: marcado }}
                >
                  <Text style={[s.prazoRotulo, marcado && { color: cor.folha }]}>{p.rotulo}</Text>
                  <Text style={[s.prazoFim, marcado && { color: cor.noiteTexto }]}>até {fimDoPrazo(new Date(abertoEm + p.horas * 36e5))}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.gps}>
            <MapPin size={18} color={cor.apagado} strokeWidth={1.8} />
            <Text style={s.gpsTexto}>Vamos marcar onde você está agora para achar os fretes perto.</Text>
          </View>
          <Pilula texto="Avisar que estou livre" onPress={estouLivre} ocupado={ocupado === "checkin"} />
        </View>
      </Modal>
    </Fundo>
  );
}

const s = StyleSheet.create({
  conteudo: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 120 },
  topo: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 12 },
  ola: { ...fonte(500), fontSize: 30, lineHeight: 35, letterSpacing: -0.6, color: cor.tinta },
  veiculo: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  veiculoTexto: { ...fonte(400), fontSize: 14, color: cor.apagado },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "hsl(150, 45%, 90%)", alignItems: "center", justifyContent: "center" },
  avatarTexto: { ...fonte(600), fontSize: 16, color: "hsl(150, 40%, 28%)" },
  situacao: { borderRadius: 26, padding: 20, boxShadow: sombra.cartao },
  livre: { backgroundColor: cor.verde },
  parado: { backgroundColor: cor.noite },
  formaCanto: { position: "absolute", right: 20, top: 26 },
  situacaoTitulo: { ...fonte(600), fontSize: 24, lineHeight: 28, letterSpacing: -0.2 },
  paradoTexto: { ...fonte(400), fontSize: 15, lineHeight: 21, color: cor.noiteTexto, marginTop: 6, marginBottom: 16 },
  ate: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 10, marginBottom: 12, flexWrap: "wrap" },
  ateNumero: { ...fonte(600), fontSize: 40, lineHeight: 44, letterSpacing: -0.8, color: "#fff" },
  ateTexto: { ...fonte(400), fontSize: 15, color: "rgba(255,255,255,0.86)" },
  onde: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  ondeTexto: { ...fonte(400), fontSize: 14, color: "rgba(255,255,255,0.9)", flex: 1 },
  falta: { marginTop: 14, borderRadius: 22, padding: 16, backgroundColor: cor.laranjaClaro, borderWidth: 1, borderColor: "rgba(227,139,61,0.35)", gap: 8 },
  faltaCab: { flexDirection: "row", alignItems: "center", gap: 10 },
  faltaTitulo: { ...fonte(600), fontSize: 16, color: cor.laranjaTinta, flex: 1 },
  faltaItem: { ...fonte(400), fontSize: 14, lineHeight: 20, color: cor.laranjaTinta },
  faltaNota: { ...fonte(400), fontSize: 13, color: cor.apagado },
  secao: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 24, marginBottom: 10, paddingHorizontal: 4 },
  secaoTitulo: { ...fonte(600), fontSize: 18, color: cor.tinta },
  secaoConta: { ...fonte(400), fontSize: 13, color: cor.apagado },
  vazio: { borderRadius: 24, borderWidth: 1.5, borderStyle: "dashed", borderColor: cor.meioFio, padding: 20 },
  vazioTexto: { ...fonte(400), fontSize: 15, lineHeight: 21, color: cor.apagado, textAlign: "center" },
  frete: { padding: 16, marginBottom: 12 },
  freteCab: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  valor: { ...fonte(600), fontSize: 30, lineHeight: 34, letterSpacing: -0.6, color: cor.tinta },
  valorUnidade: { ...fonte(400), fontSize: 15, color: cor.apagado, letterSpacing: 0 },
  valorSub: { ...fonte(400), fontSize: 13, color: cor.apagado, marginTop: 2 },
  rota: { flexDirection: "row", gap: 12, marginTop: 16, marginBottom: 12 },
  trilho: { width: 18, alignItems: "center", paddingVertical: 5 },
  pontoInicio: { width: 13, height: 13, borderRadius: 7, borderWidth: 2.5, borderColor: cor.tinta, backgroundColor: cor.folha },
  pontoFim: { width: 12, height: 12, borderRadius: 3, backgroundColor: cor.tinta },
  estrada: { flex: 1, width: 4, justifyContent: "space-evenly", alignItems: "center", marginVertical: 3 },
  faixa: { width: 4, height: 6, borderRadius: 2, backgroundColor: cor.tinta },
  cidade: { ...fonte(600), fontSize: 18, lineHeight: 22, color: cor.tinta },
  quando: { ...fonte(400), fontSize: 13, color: cor.apagado },
  fatos: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  fato: { ...fonte(400), fontSize: 13, color: cor.tinta, backgroundColor: "rgba(255,255,255,0.7)", borderWidth: 1, borderColor: cor.borda, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, overflow: "hidden" },
  recado: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: cor.azulClaro, borderRadius: 14, padding: 12, marginBottom: 14, paddingTop: 13 },
  recadoTexto: { ...fonte(400), fontSize: 14, lineHeight: 19, color: cor.azulTinta, flex: 1, marginTop: -4 },
  ja: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: cor.verdeClaro, borderRadius: 16, padding: 12, marginBottom: 4 },
  jaTexto: { ...fonte(400), fontSize: 14, lineHeight: 19, color: cor.verdeTinta, flex: 1 },
  menu: { position: "absolute", left: 16, right: 16, bottom: 18, height: 68, borderRadius: 28, backgroundColor: cor.noite, flexDirection: "row", padding: 8, gap: 4, boxShadow: sombra.flutuante },
  menuItem: { flex: 1, borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 3 },
  menuAtual: { backgroundColor: cor.circulo },
  menuTexto: { ...fonte(500), fontSize: 12, color: cor.noiteTexto },
  menuConta: { position: "absolute", top: 4, right: "28%", minWidth: 18, height: 18, borderRadius: 9, backgroundColor: cor.ferrugem, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  menuContaTexto: { ...fonte(700), fontSize: 11, color: "#fff" },
  veu: { flex: 1, backgroundColor: "rgba(40,32,24,0.32)" },
  folha: { position: "absolute", left: 8, right: 8, bottom: 8, backgroundColor: cor.folha, borderRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 22, boxShadow: sombra.flutuante },
  alca: { width: 40, height: 5, borderRadius: 3, backgroundColor: cor.meioFio, alignSelf: "center", marginBottom: 16 },
  folhaTitulo: { ...fonte(600), fontSize: 22, lineHeight: 28, color: cor.tinta },
  folhaTexto: { ...fonte(400), fontSize: 15, lineHeight: 21, color: cor.apagado, marginTop: 6, marginBottom: 16 },
  prazos: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  prazo: { width: "48%", flexGrow: 1, minHeight: 66, borderRadius: 18, borderWidth: 1, borderColor: "rgba(22,24,24,0.14)", backgroundColor: "#fff", justifyContent: "center", paddingHorizontal: 16 },
  prazoMarcado: { backgroundColor: cor.noite, borderColor: cor.noite },
  prazoRotulo: { ...fonte(600), fontSize: 18, color: cor.tinta },
  prazoFim: { ...fonte(400), fontSize: 13, color: cor.apagado },
  gps: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 16 },
  gpsTexto: { ...fonte(400), fontSize: 13, lineHeight: 18, color: cor.apagado, flex: 1 },
});
