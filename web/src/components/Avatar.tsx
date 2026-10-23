/* Avatar com as iniciais (`N.desenhar.avatar`): cor estável derivada do nome. */
export function Avatar({ nome }: { nome: string | null | undefined }) {
  const ini = (nome || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  let h = 0;
  for (const ch of nome || "") h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span className="avatar" style={{ background: `hsl(${h} 45% 90%)`, color: `hsl(${h} 40% 28%)` }}>
      {ini}
    </span>
  );
}
