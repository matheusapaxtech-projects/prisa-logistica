/* Localização o tempo todo (pedido de 2026-10-25): o despacho escolhe o motorista mais perto da coleta.
   O Android mantém um serviço com aviso fixo ("Prisa: localização ativa") e entrega a posição mesmo com o app
   fechado; cada posição vai para registrar_posicao (o banco guarda só a última). Precisa da versão própria
   do app (development build): o Expo Go do Android não roda serviço em segundo plano. */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Linking, Platform } from "react-native";
import { supabase } from "./supabase";

export const TAREFA_POSICAO = "prisa-posicao-motorista";

// A tarefa precisa ser definida no topo do módulo (importado por index.ts antes do app).
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TAREFA_POSICAO, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const ultima = data.locations.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return;
  await supabase.rpc("registrar_posicao", {
    p_latitude: Number(ultima.coords.latitude.toFixed(6)),
    p_longitude: Number(ultima.coords.longitude.toFixed(6)),
    p_precisao_m: ultima.coords.accuracy ?? undefined,
    p_em: new Date(ultima.timestamp).toISOString(),
  });
});

export type EstadoLocalizacao = "ativa" | "sem_permissao" | "so_com_app_aberto" | "gps_desligado" | "indisponivel";

/** Situação atual, sem pedir nada ao motorista. */
export async function estadoLocalizacao(): Promise<EstadoLocalizacao> {
  if (!(await Location.hasServicesEnabledAsync())) return "gps_desligado";
  const frente = await Location.getForegroundPermissionsAsync();
  if (frente.status !== "granted") return "sem_permissao";
  const fundo = await Location.getBackgroundPermissionsAsync();
  if (fundo.status !== "granted") return "so_com_app_aberto";
  return (await Location.hasStartedLocationUpdatesAsync(TAREFA_POSICAO)) ? "ativa" : "indisponivel";
}

/** Pede as permissões (primeiro "usando o app", depois "o tempo todo") e liga o envio. */
export async function ativarLocalizacao(): Promise<EstadoLocalizacao> {
  const frente = await Location.requestForegroundPermissionsAsync();
  if (frente.status !== "granted") return "sem_permissao";
  const fundo = await Location.requestBackgroundPermissionsAsync();
  if (fundo.status !== "granted") return "so_com_app_aberto";
  await ligarEnvio();
  return "ativa";
}

/** Liga o serviço se as permissões já existem (ao abrir o app). */
export async function ligarEnvio(): Promise<void> {
  if ((await Location.getBackgroundPermissionsAsync()).status !== "granted") return;
  if (await Location.hasStartedLocationUpdatesAsync(TAREFA_POSICAO)) return;
  await Location.startLocationUpdatesAsync(TAREFA_POSICAO, {
    accuracy: Location.Accuracy.Balanced,
    // Economia de bateria: a cada 1 km rodado ou 10 min, o que vier antes.
    distanceInterval: 1000,
    timeInterval: 10 * 60 * 1000,
    deferredUpdatesInterval: 10 * 60 * 1000,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Prisa: localização ativa",
      notificationBody: "Para a Prisa achar os fretes perto de você.",
      notificationColor: "#2C5A4D",
      killServiceOnDestroy: false,
    },
  });
}

/** Ao sair do app: para de mandar a posição. */
export async function desligarEnvio(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(TAREFA_POSICAO)) await Location.stopLocationUpdatesAsync(TAREFA_POSICAO);
}

/** Envia a posição agora (ao abrir o app e no "Estou livre"), sem esperar o serviço. */
export async function enviarPosicaoAgora(): Promise<Location.LocationObject | null> {
  if ((await Location.getForegroundPermissionsAsync()).status !== "granted") return null;
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  await supabase.rpc("registrar_posicao", {
    p_latitude: Number(p.coords.latitude.toFixed(6)),
    p_longitude: Number(p.coords.longitude.toFixed(6)),
    p_precisao_m: p.coords.accuracy ?? undefined,
    p_em: new Date(p.timestamp).toISOString(),
  });
  return p;
}

export const abrirAjustes = () => (Platform.OS === "ios" ? Linking.openURL("app-settings:") : Linking.openSettings());
