// Shared Sanaa wordmark (mirrors HR's SanaBrand) so every Sanaa product renders the same brand row.
export function SanaaBrand({
  module = "Tasks",
  mark = true,
  className = "",
}: {
  module?: string;
  mark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`sana-brand ${className}`.trim()}
      dir="ltr"
      aria-label={`Sanaa ${module}`}
    >
      {mark && (
        <img
          className="sana-brand-mark"
          src="/sanaa-mark.png"
          alt=""
          aria-hidden="true"
        />
      )}
      <strong>Sanaa</strong>
      <i>{module}</i>
    </span>
  );
}
