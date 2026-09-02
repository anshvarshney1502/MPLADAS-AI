export function SectionHead({ title, tag }: { title: string; tag?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="font-heading text-[17px] font-semibold tracking-tight text-primary">{title}</h3>
      {tag ? <span className="text-[12px] text-text-muted">{tag}</span> : null}
    </div>
  );
}
