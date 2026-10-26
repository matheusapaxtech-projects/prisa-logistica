// Marca do NILT: placa verde de rodovia com a seta de saída (a rota que deixa a pista rumo à entrega).
// Fonte única do desenho: o menu, a entrada, o ícone da aba (app/icon.svg) e as imagens geradas
// (apple-icon, opengraph-image, icone/[arquivo]) seguem estas medidas. Mudou aqui, mude lá.

/** Verde de placa de rodovia: só a marca usa este tom; as telas seguem o --verde do DESIGN.md. */
export const VERDE_PLACA = "#0b6b3a";

/** Traços da seta de saída numa grade de 32×32, centrados na placa. */
export const SETA_SAIDA = ["M11 25.5v-8c0-4 3-7 7-7h3", "M17 6.5l4 4-4 4"] as const;

/** Só a seta branca, para quando o fundo já é a placa (ex.: a placa grande da entrada). */
export function SetaSaida({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="#fff"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {SETA_SAIDA.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** A placa com a seta. O filete branco por dentro some em tamanhos pequenos, onde vira ruído. */
export function SinalNilt({ className, filete = true }: { className?: string; filete?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill={VERDE_PLACA} />
      {filete && (
        <rect x="2.4" y="2.4" width="27.2" height="27.2" rx="4" fill="none" stroke="#fff" strokeWidth="1.3" />
      )}
      <g fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {SETA_SAIDA.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
