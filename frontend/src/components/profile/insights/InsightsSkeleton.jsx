export default function InsightsSkeleton({ theme }) {
  const blocks = Array.from({ length: 10 });

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {blocks.map((_, i) => (
        <div
          key={i}
          className="p-4 animate-pulse"
          style={{ borderRadius: 18, background: theme.cardBg, border: `1px solid ${theme.border}`, height: 100 }}
        >
          <div className="w-1/2 h-3 rounded-full mb-3" style={{ background: theme.track }} />
          <div className="w-full h-3 rounded-full mb-2" style={{ background: theme.track }} />
          <div className="w-2/3 h-3 rounded-full" style={{ background: theme.track }} />
        </div>
      ))}
    </div>
  );
}
