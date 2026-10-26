import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { LOGIN_TESTE, mensagem, supabase } from "../supabase";
import { cor } from "../tema";

/** (43) 99999-8888 → +5543999998888 */
function celularE164(texto: string): string | null {
  let d = texto.replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^55[1-9][0-9]9[0-9]{8}$/.test(d) ? `+${d}` : null;
}

/* Entrada: o motorista digita o celular liberado pela Prisa e recebe o código no WhatsApp. */
export function Entrar() {
  const [celular, setCelular] = useState("");
  const [codigo, setCodigo] = useState("");
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
      if (!phone) throw new Error("Digite o celular com DDD, com o 9 na frente.");
      const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel: "whatsapp" } });
      if (error) throw error;
      setEnviado(phone);
    });

  const confirmar = () =>
    rodar(async () => {
      const { error } = await supabase.auth.verifyOtp({ phone: enviado!, token: codigo.trim(), type: "sms" });
      if (error) throw new Error("Código errado ou vencido. Peça outro.");
    });

  const entrarTeste = () =>
    rodar(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: "teste.motorista@nilt.test", password: "nilt-local-123" });
      if (error) throw error;
    });

  return (
    <View style={s.tela}>
      <View style={s.marca}>
        <Text style={s.marcaNome}>PRISA</Text>
        <Text style={s.marcaSub}>App do motorista</Text>
      </View>

      <View style={s.cartao}>
        {!enviado ? (
          <>
            <Text style={s.titulo}>Entrar</Text>
            <Text style={s.texto}>Use o celular que você passou para a Prisa. O código chega no seu WhatsApp.</Text>
            <Text style={s.rotulo}>Celular com WhatsApp</Text>
            <TextInput
              style={s.campo}
              value={celular}
              onChangeText={setCelular}
              keyboardType="phone-pad"
              placeholder="(43) 99999-8888"
              placeholderTextColor={cor.apagado}
            />
            <Botao texto="Receber código no WhatsApp" onPress={pedirCodigo} ocupado={ocupado} />
          </>
        ) : (
          <>
            <Text style={s.titulo}>Digite o código</Text>
            <Text style={s.texto}>Mandamos um código de 6 números para o WhatsApp do celular {enviado.slice(3)}.</Text>
            <TextInput
              style={[s.campo, s.codigo]}
              value={codigo}
              onChangeText={setCodigo}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              placeholderTextColor={cor.apagado}
            />
            <Botao texto="Entrar" onPress={confirmar} ocupado={ocupado} />
            <Pressable onPress={() => setEnviado(null)} style={s.link}>
              <Text style={s.linkTexto}>Trocar o celular</Text>
            </Pressable>
          </>
        )}
        {erro && <Text style={s.erro}>{erro}</Text>}
      </View>

      {LOGIN_TESTE && (
        <Pressable onPress={entrarTeste} style={s.teste} disabled={ocupado}>
          <Text style={s.testeTexto}>Entrar como motorista de teste (só no banco local)</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Botao({ texto, onPress, ocupado, tipo = "primario" }: { texto: string; onPress: () => void; ocupado?: boolean; tipo?: "primario" | "secundario" }) {
  const prim = tipo === "primario";
  return (
    <Pressable
      onPress={onPress}
      disabled={ocupado}
      style={({ pressed }) => [s.botao, prim ? s.botaoPrim : s.botaoSec, (pressed || ocupado) && { opacity: 0.7 }]}
    >
      {ocupado ? <ActivityIndicator color={prim ? "#fff" : cor.verde} /> : <Text style={[s.botaoTexto, !prim && { color: cor.verde }]}>{texto}</Text>}
    </Pressable>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo, padding: 20, justifyContent: "center" },
  marca: { backgroundColor: cor.verde, borderRadius: 14, padding: 18, marginBottom: 20 },
  marcaNome: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: 2 },
  marcaSub: { color: "#e1ebe4", fontSize: 13, letterSpacing: 1, textTransform: "uppercase" },
  cartao: { backgroundColor: cor.folha, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: cor.borda },
  titulo: { fontSize: 22, fontWeight: "700", color: cor.tinta, marginBottom: 6 },
  texto: { fontSize: 15, color: cor.apagado, marginBottom: 16, lineHeight: 21 },
  rotulo: { fontSize: 13, fontWeight: "600", color: cor.tinta, marginBottom: 6 },
  campo: { borderWidth: 1, borderColor: "#cdc5b6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, color: cor.tinta, backgroundColor: "#fff", marginBottom: 16 },
  codigo: { fontSize: 26, letterSpacing: 8, textAlign: "center" },
  botao: { borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center", minHeight: 50 },
  botaoPrim: { backgroundColor: cor.verde },
  botaoSec: { backgroundColor: cor.verdeClaro },
  botaoTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
  link: { alignItems: "center", paddingTop: 14 },
  linkTexto: { color: cor.verde, fontSize: 15, fontWeight: "600" },
  erro: { marginTop: 14, color: cor.vermelhoTinta, backgroundColor: cor.vermelhoClaro, padding: 12, borderRadius: 8, fontSize: 14 },
  teste: { marginTop: 18, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#b8901a", backgroundColor: cor.amareloClaro },
  testeTexto: { color: cor.amareloTinta, textAlign: "center", fontWeight: "600" },
});
