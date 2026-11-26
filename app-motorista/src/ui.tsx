/* Peças comuns do app, no desenho do NILT: fundo quente, vidro, pílulas, placa Mercosul e sinais com forma. */
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { cor, fonte, FUNDO_GRADIENTE, mono, sombra } from "./tema";

export function Fundo({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.fundo, style]}>{children}</View>;
}

export function Vidro({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.vidro, style]}>{children}</View>;
}

type TipoPilula = "primaria" | "secundaria" | "clara" | "texto";

/** Botão em pílula. Primária = noite (uma por tela). */
export function Pilula({
  texto,
  onPress,
  tipo = "primaria",
  ocupado,
  icone,
  desativado,
}: {
  texto: string;
  onPress: () => void;
  tipo?: TipoPilula;
  ocupado?: boolean;
  icone?: ReactNode;
  desativado?: boolean;
}) {
  const claro = tipo !== "primaria";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={ocupado || desativado}
      style={({ pressed }) => [s.pilula, s[tipo], pressed && { transform: [{ scale: 0.97 }] }, (ocupado || desativado) && { opacity: 0.6 }]}
    >
      {ocupado ? (
        <ActivityIndicator color={claro ? cor.tinta : cor.folha} />
      ) : (
        <View style={s.pilulaConteudo}>
          {icone}
          <Text style={[s.pilulaTexto, claro && { color: tipo === "clara" ? cor.tinta : cor.tinta }, tipo === "texto" && s.pilulaTextoLink]}>
            {texto}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Placa Mercosul desenhada (contorno de tinta, faixa azul "BRASIL", letras em Overpass Mono). */
export function Placa({ placa, grande }: { placa: string; grande?: boolean }) {
  return (
    <View style={[s.placa, grande && s.placaGrande]}>
      <Text style={[s.placaFaixa, grande && s.placaFaixaGrande]}>BRASIL</Text>
      <Text style={[mono, s.placaLetras, grande && s.placaLetrasGrande]}>{placa}</Text>
    </View>
  );
}

type Situacao = "normal" | "pendente" | "vencendo" | "bloqueado" | "info";

/** Sinal de situação: pílula com a forma da placa (retângulo, losango, círculo vazado, quadrado). */
export function Sinal({ tipo, texto }: { tipo: Situacao; texto: string }) {
  const c = SINAIS[tipo];
  return (
    <View style={[s.sinal, { backgroundColor: c.fundo }]}>
      <Forma tipo={tipo} />
      <Text style={[s.sinalTexto, { color: c.tinta }]}>{texto}</Text>
    </View>
  );
}

export function Forma({ tipo, cor: corForma }: { tipo: Situacao; cor?: string }) {
  const c = corForma ?? SINAIS[tipo].marca;
  if (tipo === "normal") return <View style={{ width: 11, height: 7, borderRadius: 2, backgroundColor: c }} />;
  if (tipo === "bloqueado") return <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: c }} />;
  if (tipo === "info") return <View style={{ width: 9, height: 9, backgroundColor: c }} />;
  return <View style={{ width: 8, height: 8, backgroundColor: c, transform: [{ rotate: "45deg" }] }} />;
}

const SINAIS: Record<Situacao, { fundo: string; tinta: string; marca: string }> = {
  normal: { fundo: cor.verdeClaro, tinta: cor.verdeTinta, marca: cor.verde },
  pendente: { fundo: cor.laranjaClaro, tinta: cor.laranjaTinta, marca: cor.laranja },
  vencendo: { fundo: cor.mostardaClaro, tinta: cor.mostardaTinta, marca: "#e7c14b" },
  bloqueado: { fundo: cor.ferrugemClaro, tinta: cor.ferrugemTinta, marca: cor.ferrugem },
  info: { fundo: cor.azulClaro, tinta: cor.azulTinta, marca: cor.azul },
};

export function Aviso({ tipo, titulo, texto }: { tipo: "erro" | "pendente" | "vencendo"; titulo?: string; texto: string }) {
  const c = tipo === "erro" ? { f: cor.ferrugemClaro, t: cor.ferrugemTinta } : tipo === "pendente" ? { f: cor.laranjaClaro, t: cor.laranjaTinta } : { f: cor.mostardaClaro, t: cor.mostardaTinta };
  return (
    <View style={[s.aviso, { backgroundColor: c.f }]}>
      {titulo && <Text style={[s.avisoTitulo, { color: c.t }]}>{titulo}</Text>}
      <Text style={[s.avisoTexto, { color: c.t }]}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: cor.fundo, experimental_backgroundImage: FUNDO_GRADIENTE },
  vidro: { backgroundColor: cor.vidro, borderColor: cor.vidroBorda, borderWidth: 1, borderRadius: 24, boxShadow: sombra.painel },
  pilula: { minHeight: 52, borderRadius: 999, paddingHorizontal: 22, alignItems: "center", justifyContent: "center" },
  pilulaConteudo: { flexDirection: "row", alignItems: "center", gap: 8 },
  primaria: { backgroundColor: cor.noite },
  secundaria: { backgroundColor: "rgba(255,255,255,0.62)", borderWidth: 1, borderColor: "rgba(22,24,24,0.14)" },
  clara: { backgroundColor: "rgba(255,255,255,0.92)" },
  texto: { backgroundColor: "transparent", minHeight: 44 },
  pilulaTexto: { ...fonte(600), fontSize: 16, color: cor.folha },
  pilulaTextoLink: { ...fonte(500), textDecorationLine: "underline", textDecorationColor: "rgba(22,24,24,0.3)" },
  placa: { width: 92, height: 30, borderWidth: 1.5, borderColor: cor.tinta, borderRadius: 4, overflow: "hidden", backgroundColor: "#fff" },
  placaGrande: { width: 190, height: 74, borderWidth: 2.5, borderRadius: 12, boxShadow: sombra.cartao },
  placaFaixa: { height: 7, backgroundColor: cor.placaAzul, color: "#fff", fontSize: 5, lineHeight: 7, textAlign: "center", letterSpacing: 0.6, ...fonte(600) },
  placaFaixaGrande: { height: 18, fontSize: 10, lineHeight: 18, letterSpacing: 1.6 },
  placaLetras: { flex: 1, fontSize: 14, lineHeight: 21, textAlign: "center", letterSpacing: 0.8, color: cor.tinta },
  placaLetrasGrande: { fontSize: 38, lineHeight: 54, letterSpacing: 3 },
  sinal: { flexDirection: "row", alignItems: "center", gap: 6, height: 26, paddingHorizontal: 10, borderRadius: 999, alignSelf: "flex-start" },
  sinalTexto: { ...fonte(600), fontSize: 12 },
  aviso: { borderRadius: 16, padding: 12 },
  avisoTitulo: { ...fonte(600), fontSize: 15, marginBottom: 2 },
  avisoTexto: { ...fonte(400), fontSize: 14, lineHeight: 20 },
});
