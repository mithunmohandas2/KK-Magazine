const paletteUtility =
  /^(?:bg|from|via|to)-(?:transparent|black|white|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950))$/;
const gradientUtility =
  /^bg-(?:(?:linear|gradient)-to-(?:t|tr|r|br|b|bl|l|tl)|radial|conic|none)$/;
const appearanceUtility =
  /^(?:bg-(?:auto|cover|contain|center|top|right|bottom|left|repeat|no-repeat|repeat-x|repeat-y)|(?:rounded|shadow)(?:-(?:none|xs|sm|md|lg|xl|2xl))?|opacity-(?:0|25|50|75|100)|(?:from|via|to)-(?:[1-9]?0|100)%)$/;

export function backgroundClassTokens(value = "") {
  return value.trim().split(/\s+/).filter(Boolean);
}

export function isBackgroundClass(token: string) {
  return (
    paletteUtility.test(token) ||
    gradientUtility.test(token) ||
    appearanceUtility.test(token)
  );
}
