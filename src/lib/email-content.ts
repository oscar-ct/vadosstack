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
