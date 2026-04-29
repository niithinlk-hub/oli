export function BrandGuidelines() {
  return (
    <div className="space-y-8 max-w-3xl text-body-sm leading-relaxed">
      <section>
        <h3 className="text-h3 mb-2">Logo usage</h3>
        <ul className="list-disc pl-5 space-y-1 text-ink-secondary">
          <li>Use the horizontal logo in headers, login screen, marketing.</li>
          <li>Use the icon for app icon, favicon, compact sidebar.</li>
          <li>Use mono only when gradients are unavailable (print, email).</li>
          <li>Keep at least the height of the icon as clear space around the mark.</li>
          <li>Never stretch, rotate, recolor randomly, or apply harsh shadows.</li>
        </ul>
      </section>
      <section>
        <h3 className="text-h3 mb-2">Color usage</h3>
        <ul className="list-disc pl-5 space-y-1 text-ink-secondary">
          <li>Blue is the primary trust/productivity color.</li>
          <li>Teal carries clarity and listening — sound waves, success.</li>
          <li>Violet signals AI, memory, and intelligence.</li>
          <li>Amber is reserved for the insight spark and warm highlights — never primary.</li>
          <li>Aim for 70% neutral surface space; color earns attention by being scarce.</li>
        </ul>
      </section>
      <section>
        <h3 className="text-h3 mb-2">Typography</h3>
        <ul className="list-disc pl-5 space-y-1 text-ink-secondary">
          <li>Inter for UI body and controls.</li>
          <li>Inter Tight (or Geist) for display headings.</li>
          <li>IBM Plex Mono for transcript timestamps and technical metadata.</li>
          <li>Avoid all-caps for long copy. Use generous line height.</li>
        </ul>
      </section>
      <section>
        <h3 className="text-h3 mb-2">UI</h3>
        <ul className="list-disc pl-5 space-y-1 text-ink-secondary">
          <li>Cards use 20px radius, soft shadows, generous padding.</li>
          <li>Gradients reserved for hero, AI, and insight surfaces.</li>
          <li>Keep screens calm and uncluttered — Oli should feel like clarity.</li>
        </ul>
      </section>
      <section>
        <h3 className="text-h3 mb-2">Don't</h3>
        <ul className="list-disc pl-5 space-y-1 text-ink-secondary">
          <li>Use brain or robot icons.</li>
          <li>Lean on neon or candy-colored gradients.</li>
          <li>Copy Granola, Otter, or Notion's visual language.</li>
          <li>Overuse sparkles or animated AI shimmer.</li>
        </ul>
      </section>
    </div>
  );
}
