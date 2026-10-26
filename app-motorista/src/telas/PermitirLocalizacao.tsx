import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MapPin } from "lucide-react-native";
import { abrirAjustes, ativarLocalizacao, type EstadoLocalizacao } from "../localizacao";
import { POLITICA_URL } from "../supabase";
import { cor, fonte, sombra } from "../tema";
import { Aviso, Fundo, Pilula, Vidro } from "../ui";

type Props = { estado: EstadoLocalizacao; aoTerminar: (e: EstadoLocalizacao) => void };

/* Aviso de localização em destaque (exigência do Google Play antes de pedir "o tempo todo"): o que é coletado,
   que vale com o app fechado, para quê, quem vê e como parar, com o link da política. O motorista pode recusar. */
export function PermitirLocalizacao({ estado, aoTerminar }: Props) {
  const [ocupado, setOcupado] = useState(false);
  const [atual, setAtual] = useState(estado);

  async function permitir() {
    setOcupado(true);
    try {
      const e = await ativarLocalizacao();
      setAtual(e);
      if (e === "ativa") aoTerminar(e);
    } finally {
      setOcupado(false);
    }
  }

  const precisaAjustes = atual === "so_com_app_aberto" || atual === "gps_desligado";

  return (
    <Fundo>
      <View style={s.tela}>
        <View style={s.icone}>
          <MapPin size={30} color="#fff" strokeWidth={1.8} />
        </View>
        <Text style={s.titulo}>A Prisa usa sua localização o tempo todo</Text>
        <Text style={s.texto}>Mesmo com o app fechado, o celular manda a sua posição para a Prisa a cada 1 km rodado ou 10 minutos.</Text>

        <Vidro style={s.lista}>
          <Item titulo="Para quê" texto="Achar os fretes perto de você e escolher o caminhão mais perto da coleta, com os eixos e a carroceria certos." />
          <Item titulo="Quem vê" texto="Só a operação da Prisa, no despacho. Guardamos só a última posição." />
          <Item titulo="Como parar" texto="Toque em Sair no app ou mude a permissão nos ajustes do celular. Um aviso fixo mostra quando está ligada." ultimo />
        </Vidro>
        <Pressable onPress={() => Linking.openURL(POLITICA_URL)} accessibilityRole="link" style={s.politica}>
          <Text style={s.politicaTexto}>Ler a política de privacidade</Text>
        </Pressable>

        {precisaAjustes && (
          <Aviso
            tipo="vencendo"
            texto={
              atual === "gps_desligado"
                ? "A localização do celular está desligada. Ligue nos ajustes."
                : "Para funcionar com o app fechado, escolha “Permitir o tempo todo” nos ajustes do app."
            }
          />
        )}

        <View style={s.acoes}>
          {precisaAjustes ? (
            <Pilula texto="Abrir ajustes do celular" onPress={abrirAjustes} />
          ) : (
            <Pilula texto="Permitir localização" onPress={permitir} ocupado={ocupado} />
          )}
          <Pilula texto="Agora não" tipo="secundaria" onPress={() => aoTerminar(atual)} />
        </View>
      </View>
    </Fundo>
  );
}

function Item({ titulo, texto, ultimo }: { titulo: string; texto: string; ultimo?: boolean }) {
  return (
    <View style={[s.item, !ultimo && s.itemFilete]}>
      <Text style={s.itemTitulo}>{titulo}</Text>
      <Text style={s.itemTexto}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, paddingHorizontal: 20, paddingTop: 64, paddingBottom: 28 },
  icone: { width: 64, height: 64, borderRadius: 32, backgroundColor: cor.verde, alignItems: "center", justifyContent: "center", marginBottom: 22, boxShadow: sombra.cartao },
  titulo: { ...fonte(500), fontSize: 30, lineHeight: 35, letterSpacing: -0.6, color: cor.tinta },
  texto: { ...fonte(400), fontSize: 16, lineHeight: 23, color: cor.apagado, marginTop: 10 },
  lista: { marginTop: 22, paddingHorizontal: 4 },
  item: { padding: 14 },
  itemFilete: { borderBottomWidth: 1, borderBottomColor: cor.filete },
  itemTitulo: { ...fonte(600), fontSize: 15, color: cor.tinta },
  itemTexto: { ...fonte(400), fontSize: 14, lineHeight: 20, color: cor.apagado, marginTop: 2 },
  politica: { paddingVertical: 12 },
  politicaTexto: { ...fonte(500), fontSize: 14, color: cor.tinta, textDecorationLine: "underline" },
  acoes: { marginTop: "auto", gap: 10 },
});
