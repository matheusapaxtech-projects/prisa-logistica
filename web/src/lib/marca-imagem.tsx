import { ImageResponse } from "next/og";
import { SETA_SAIDA, VERDE_PLACA } from "@/components/Logo";

// Imagens da marca geradas no servidor (ImageResponse): ícone do iPhone, ícones do app instalado
// e a prévia de link. Desenho em components/Logo.tsx.

/** Ícone quadrado de fundo inteiro: o sistema (iOS, Android) arredonda ou recorta os cantos.
    A seta fica no centro, dentro da área segura de 80% que o Android preserva ao recortar. */
export function iconeQuadrado(lado: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: VERDE_PLACA }}>
        <svg width={lado} height={lado} viewBox="-1 -1 34 34">
          <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            {SETA_SAIDA.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
        </svg>
      </div>
    ),
    { width: lado, height: lado },
  );
}

/** "NILT" em traços retos, como letreiro de placa: não depende de fonte instalada no servidor. */
const LETRAS_NILT = ["M0 100V0L60 100V0", "M92 0V100", "M124 0V100H178", "M204 0H272", "M238 0V100"];

/** Prévia de link (WhatsApp, e-mail): a placa inteira, com filete, seta e nome. */
export function previaDeLink() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: VERDE_PLACA,
          padding: 28,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 64,
            padding: "0 88px",
            border: "6px solid #fff",
            borderRadius: 36,
          }}
        >
          <svg width={250} height={250} viewBox="5 3.5 22 25">
            <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              {SETA_SAIDA.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            <svg width={420} height={168} viewBox="-12 -12 296 124">
              <g fill="none" stroke="#fff" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round">
                {LETRAS_NILT.map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
            </svg>
            <div style={{ height: 5, width: 420, background: "#fff", borderRadius: 3 }} />
            {/* quebra fixa: deixada ao acaso, o "e" ficava sozinho no fim da linha */}
            <div style={{ display: "flex", flexDirection: "column", color: "#fff", fontSize: 32, lineHeight: 1.3 }}>
              <span>Núcleo Integrado de</span>
              <span>Logística e Transporte</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
