export function mapContentTypeToApplicationType(type?: string): string {
  const value = String(type || "").toLowerCase();

  if (["book", "kitob"].includes(value)) return "book";
  if (["poem", "she'r", "sher", "she’r"].includes(value)) return "poem";
  if (["poem_collection", "she'riy to'plam", "she’riy to‘plam"].includes(value)) return "poem_collection";
  if (["roman", "novel"].includes(value)) return "novel";
  if (["story", "hikoya"].includes(value)) return "story";
  if (["qissa"].includes(value)) return "qissa";
  if (["fairy_tale", "ertak"].includes(value)) return "fairy_tale";
  if (["article", "maqola"].includes(value)) return "article";
  if (["screenplay", "ssenariy", "senariy"].includes(value)) return "screenplay";
  if (["manual", "qo'llanma", "qo‘llanma"].includes(value)) return "manual";
  if (["textbook", "darslik"].includes(value)) return "textbook";

  return "other";
}

export function getApplicationCtaLabel(type?: string): string {
  const mapped = mapContentTypeToApplicationType(type);

  switch (mapped) {
    case "book":
      return "Menda ham kitob bor";
    case "novel":
      return "Menda ham roman bor";
    case "poem":
      return "Menda ham she’r bor";
    case "poem_collection":
      return "She’riy to‘plamingizni chop eting";
    case "story":
      return "Menda ham hikoya bor";
    case "qissa":
      return "Menda ham qissa bor";
    case "fairy_tale":
      return "Menda ham ertak bor";
    case "article":
      return "Menda ham maqola bor";
    case "screenplay":
      return "Menda ssenariy bor";
    case "manual":
      return "Qo‘llanmangizni chop eting";
    case "textbook":
      return "Darsligingizni chop eting";
    default:
      return "Asaringizni chop eting";
  }
}
