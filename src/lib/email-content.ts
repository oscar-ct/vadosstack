export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function plainTextToEmailHtml(message: string) {
  const paragraphs = message
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const content = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 12px;color:#3d352f;font-size:14px;line-height:1.65;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f1eb;color:#171412;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
      <div style="background:#ffffff;border:1px solid #e4ddd2;border-radius:10px;padding:22px;box-shadow:0 8px 24px rgba(23,20,18,0.05);">
        ${content}
      </div>
    </div>
  </body>
</html>`;
}

function getHtmlAttributes(value: string) {
  const attributes = new Map<string, string>();
  const attributePattern = /([a-z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match = attributePattern.exec(value);

  while (match) {
    attributes.set(match[1]?.toLowerCase() ?? "", match[2] ?? match[3] ?? match[4] ?? "");
    match = attributePattern.exec(value);
  }

  return attributes;
}

function isSafeEmailUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isSafeEmailColor(value: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\(\s*[\d\s,.%]+\)$/i.test(value);
}

function isSafeEmailFontSize(value: string) {
  const match = /^(\d+(?:\.\d+)?)px$/i.exec(value);
  if (!match) return false;

  const size = Number(match[1]);
  return size >= 10 && size <= 28;
}

function sanitizeEmailStyle(value: string) {
  const declarations = value
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean);
  const safeDeclarations: string[] = [];

  for (const declaration of declarations) {
    const [property, ...rawValue] = declaration.split(":");
    const normalizedProperty = property?.trim().toLowerCase();
    const normalizedValue = rawValue.join(":").trim();

    if (!normalizedProperty || !normalizedValue) continue;

    if (normalizedProperty === "text-align" && ["center", "left", "right"].includes(normalizedValue)) {
      safeDeclarations.push(`text-align:${normalizedValue}`);
    }

    if (["background-color", "color"].includes(normalizedProperty) && isSafeEmailColor(normalizedValue)) {
      safeDeclarations.push(`${normalizedProperty}:${normalizedValue}`);
    }

    if (normalizedProperty === "font-size" && isSafeEmailFontSize(normalizedValue)) {
      safeDeclarations.push(`font-size:${normalizedValue}`);
    }
  }

  return safeDeclarations.join(";");
}

export function sanitizeEmailHtml(value?: string) {
  if (!value) return undefined;

  const allowedTags = new Set([
    "a",
    "b",
    "blockquote",
    "br",
    "div",
    "em",
    "i",
    "li",
    "mark",
    "ol",
    "p",
    "s",
    "span",
    "strong",
    "u",
    "ul",
  ]);
  const styleTags = new Set(["blockquote", "div", "mark", "p", "span"]);
  const withoutScripts = value.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");

  return withoutScripts.replace(/<\/?([a-z0-9]+)([^>]*)?>/gi, (tag, tagName: string, rawAttributes: string) => {
    const normalized = tagName.toLowerCase();

    if (!allowedTags.has(normalized)) {
      return escapeHtml(tag);
    }

    if (tag.startsWith("</")) return `</${normalized}>`;
    if (normalized === "br") return "<br>";

    const attributes = getHtmlAttributes(rawAttributes ?? "");
    const safeAttributes: string[] = [];

    if (normalized === "a") {
      const href = attributes.get("href");

      if (href && isSafeEmailUrl(href)) {
        safeAttributes.push(`href="${escapeHtml(href)}"`, 'rel="noopener noreferrer"', 'target="_blank"');
      }
    }

    if (styleTags.has(normalized)) {
      const safeStyle = sanitizeEmailStyle(attributes.get("style") ?? "");

      if (safeStyle) {
        safeAttributes.push(`style="${escapeHtml(safeStyle)}"`);
      }
    }

    return safeAttributes.length ? `<${normalized} ${safeAttributes.join(" ")}>` : `<${normalized}>`;
  });
}
