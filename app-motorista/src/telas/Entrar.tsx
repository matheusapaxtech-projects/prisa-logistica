import { useEffect, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ChevronLeft, MessageCircle } from "lucide-react-native";
import { LOGIN_TESTE, mensagem, POLITICA_URL, supabase } from "../supabase";
import { cor, fonte, numeros } from "../tema";
import { Aviso, Fundo, Pilula, Placa } from "../ui";

/** (43) 99999-8888 → +5543999998888 */
function celularE164(texto: string): string | null {
  let d = texto.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55[1-9][0-9]9[0-9]{8}$/.test(d) ? `+${d}` : null;
}

/** 43999990001 → (43) 99999-0001 enquanto digita. */
function mascara(texto: string): string {
  const d = texto.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const ESPERA_REENVIO = 60;

/* Entrada: o motorista digita o celular liberado pela Prisa e recebe o código no WhatsApp. */
export function Entrar() {
  const [celular, setCelular] = useState("");
  const [enviado, setEnviado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function rodar(f: () => Promise<void>) {
    setErro(null);
    setOcupado(true);
    try {
      await f();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  }

  const pedirCodigo = () =>
    rodar(async () => {
      const phone = celularE164(celular);
      if (!phone) throw new Error("Digite o celular com DDD e o 9 na frente.");
      const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel: "whatsapp" } });
      if (error) throw error;
      setEnviado(phone);
    });

  const entrarTeste = () =>
    rodar(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: "teste.motorista@nilt.test", password: "nilt-local-123" });
      if (error) throw error;
    });

  if (enviado) return <Codigo celular={enviado} celularTela={celular} aoVoltar={() => setEnviado(null)} aoReenviar={pedirCodigo} />;

  return (
    <Fundo>
      <KeyboardAvoidingView style={s.tela} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ marginTop: 40 }}>
          <Placa placa="PRISA" grande />
        </View>
        <Text style={s.titulo}>Fretes perto de você, direto da Prisa</Text>
        <Text style={s.sub}>Avise quando estiver livre e veja as cargas que cabem no seu caminhão, com o valor do seu frete.</Text>

        <View style={s.base}>
          <Text style={s.rotulo}>Seu celular com WhatsApp</Text>
          <View style={s.caixa}>
            <Text style={s.ddi}>+55</Text>
            <TextInput
              style={s.entrada}
              value={celular}
              onChangeText={(t) => setCelular(mascara(t))}
              keyboardType="phone-pad"
              placeholder="(43) 99999-0001"
              placeholderTextColor={cor.fraco}
              accessibilityLabel="Seu celular com WhatsApp"
            />
          </View>
          <Text style={s.ajuda}>O mesmo número que você passou para a operação.</Text>
          {erro && (
            <View style={{ marginBottom: 12 }}>
              <Aviso tipo="erro" texto={erro} />
            </View>
          )}
          <Pilula texto="Receber código" onPress={pedirCodigo} ocupado={ocupado} icone={<MessageCircle size={18} color={cor.folha} strokeWidth={2} />} />
          {LOGIN_TESTE && <Pilula texto="Entrar como motorista de teste" tipo="secundaria" onPress={entrarTeste} desativado={ocupado} />}
          <Pressable onPress={() => Linking.openURL(POLITICA_URL)} style={s.politica} accessibilityRole="link">
            <Text style={s.politicaTexto}>Política de privacidade</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Fundo>
  );
}

/* Código de 6 números: casas grandes, teclado de números e reenvio depois de 1 minuto. */
function Codigo({ celular, celularTela, aoVoltar, aoReenviar }: { celular: string; celularTela: string; aoVoltar: () => void; aoReenviar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(ESPERA_REENVIO);
  const campo = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const t = setInterval(() => setEspera((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  async function confirmar(c = codigo) {
    if (c.length !== 6) return;
    setErro(null);
    setOcupado(true);
    const { error } = await supabase.auth.verifyOtp({ phone: celular, token: c, type: "sms" });
    setOcupado(false);
    if (error) setErro("Código errado ou vencido. Confira ou peça outro.");
  }

  return (
    <Fundo>
      <View style={s.tela}>
        <Pressable onPress={aoVoltar} style={s.voltar} accessibilityRole="button" accessibilityLabel="Trocar o celular">
          <ChevronLeft size={22} color={cor.tinta} strokeWidth={2} />
        </Pressable>
        <Text style={s.titulo}>Digite o código do WhatsApp</Text>
        <Text style={s.sub}>Mandamos 6 números para {celularTela}.</Text>

        <Pressable style={s.casas} onPress={() => campo.current?.focus()}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={i} style={[s.casa, i === codigo.length && s.casaFoco]}>
              <Text style={[s.casaTexto, numeros]}>{codigo[i] ?? ""}</Text>
            </View>
          ))}
        </Pressable>
        <TextInput
          ref={campo}
          value={codigo}
          onChangeText={(t) => {
            const c = t.replace(/\D/g, "").slice(0, 6);
            setCodigo(c);
            if (c.length === 6) confirmar(c);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          maxLength={6}
          style={s.oculto}
          accessibilityLabel="Código de 6 números"
        />
        {erro && <Aviso tipo="erro" texto={erro} />}
        <Pilula
          tipo="texto"
          texto={espera > 0 ? `Não chegou? Mandar de novo em 0:${String(espera).padStart(2, "0")}` : "Mandar o código de novo"}
          desativado={espera > 0}
          onPress={() => {
            setEspera(ESPERA_REENVIO);
            aoReenviar();
          }}
        />
        <View style={s.base}>
          <Pilula texto="Entrar" onPress={() => confirmar()} ocupado={ocupado} desativado={codigo.length !== 6} />
        </View>
      </View>
    </Fundo>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 28 },
  titulo: { ...fonte(500), fontSize: 34, lineHeight: 39, letterSpacing: -0.6, color: cor.tinta, marginTop: 28 },
  sub: { ...fonte(400), fontSize: 16, lineHeight: 23, color: cor.apagado, marginTop: 10, maxWidth: 320 },
  base: { marginTop: "auto", gap: 10 },
  rotulo: { ...fonte(500), fontSize: 14, color: cor.tinta },
  caixa: { flexDirection: "row", alignItems: "center", height: 58, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: cor.meioFio, paddingHorizontal: 16 },
  ddi: { ...fonte(400), fontSize: 16, color: cor.apagado, paddingRight: 12, marginRight: 12, borderRightWidth: 1, borderRightColor: cor.borda },
  entrada: { flex: 1, ...fonte(400), fontSize: 20, color: cor.tinta, ...numeros },
  ajuda: { ...fonte(400), fontSize: 13, color: cor.apagado, marginBottom: 6 },
  politica: { alignItems: "center", paddingVertical: 8 },
  politicaTexto: { ...fonte(500), fontSize: 13, color: cor.apagado, textDecorationLine: "underline" },
  voltar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.62)", borderWidth: 1, borderColor: "rgba(22,24,24,0.14)", alignItems: "center", justifyContent: "center" },
  casas: { flexDirection: "row", gap: 8, marginTop: 28, marginBottom: 12 },
  casa: { flex: 1, height: 62, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: cor.meioFio, alignItems: "center", justifyContent: "center" },
  casaFoco: { borderWidth: 2, borderColor: cor.noite },
  casaTexto: { ...fonte(600), fontSize: 26, color: cor.tinta },
  oculto: { position: "absolute", opacity: 0, height: 1, width: 1 },
});
