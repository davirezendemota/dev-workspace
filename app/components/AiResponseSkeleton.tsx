export default function AiResponseSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      <div
        className="ai-skeleton-line h-2 w-[84%]"
        style={{ animationDelay: '0ms' }}
      />
      <div
        className="ai-skeleton-line h-2 w-[70%]"
        style={{ animationDelay: '120ms' }}
      />
      <div
        className="ai-skeleton-line h-2 w-[77%]"
        style={{ animationDelay: '240ms' }}
      />
    </div>
  );
}
