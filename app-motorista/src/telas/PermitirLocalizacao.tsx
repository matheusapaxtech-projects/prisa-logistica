import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { abrirAjustes, ativarLocalizacao, type EstadoLocalizacao } from "../localizacao";
import { cor } from "../tema";
import { Botao } from "./Entrar";

type Props = { estado: EstadoLocalizacao; aoTerminar: (e: EstadoLocalizacao) => void };

/* Aviso de localização em destaque (exigência do Google Play antes de pedir "o tempo todo"): o que é coletado,
   que vale com o app fechado, para quê, quem vê e como parar. O motorista pode recusar. */
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
    <View style={s.tela}>
      <View style={s.icone}>
        <View style={s.pino} />
      </View>
      <Text style={s.titulo}>A Prisa usa sua localização o tempo todo</Text>
      <Text style={s.texto}>Mesmo com o app fechado, o celular manda a sua posição para a Prisa a cada 1 km rodado ou 10 minutos.</Text>

      <View style={s.lista}>
        <Item titulo="Para quê" texto="Achar os fretes perto de você e escolher o caminhão mais perto da coleta, com os eixos e a carroceria certos." />
        <Item titulo="Quem vê" texto="Só a operação da Prisa, no despacho. Guardamos só a última posição." />
        <Item titulo="Como parar" texto="Toque em Sair no app ou desligue a localização nos ajustes do celular. Um aviso fixo mostra quando está ligada." />
      </View>

      {precisaAjustes && (
        <Text style={s.alerta}>
          {atual === "gps_desligado"
            ? "A localização do celular está desligada. Ligue nos ajustes."
            : "Para funcionar com o app fechado, escolha “Permitir o tempo todo” nos ajustes do app."}
        </Text>
      )}

      <View style={s.acoes}>
        {precisaAjustes ? (
          <Botao texto="Abrir ajustes do celular" onPress={abrirAjustes} />
        ) : (
          <Botao texto="Permitir localização" onPress={permitir} ocupado={ocupado} />
        )}
        <Botao texto="Agora não" tipo="secundario" onPress={() => aoTerminar(atual)} />
      </View>
    </View>
  );
}

function Item({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <View style={s.item}>
      <Text style={s.itemTitulo}>{titulo}</Text>
      <Text style={s.itemTexto}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo, padding: 24, paddingTop: 72 },
  icone: { width: 64, height: 64, borderRadius: 32, backgroundColor: cor.verde, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  pino: { width: 18, height: 18, borderRadius: 9, borderWidth: 4, borderColor: "#fff" },
  titulo: { fontSize: 28, lineHeight: 33, fontWeight: "600", color: cor.tinta, letterSpacing: -0.4 },
  texto: { fontSize: 16, lineHeight: 23, color: cor.apagado, marginTop: 10 },
  lista: { marginTop: 24, backgroundColor: "rgba(250,246,238,0.8)", borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.8)", padding: 4 },
  item: { padding: 14, borderBottomWidth: 1, borderBottomColor: "#ebe5da" },
  itemTitulo: { fontSize: 15, fontWeight: "600", color: cor.tinta },
  itemTexto: { fontSize: 14, lineHeight: 20, color: cor.apagado, marginTop: 2 },
  alerta: { marginTop: 16, backgroundColor: cor.amareloClaro, color: cor.amareloTinta, padding: 12, borderRadius: 14, fontSize: 14, lineHeight: 20 },
  acoes: { marginTop: "auto", gap: 10 },
});
