export function SectionHead({ title, tag }: { title: string; tag?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between border-b-2 border-primary pb-1.5">
      <h3 className="font-heading text-[13px] font-bold uppercase tracking-wide text-primary">{title}</h3>
      {tag ? <span className="font-mono text-[10px] text-text-muted">{tag}</span> : null}
    </div>
  );
}
