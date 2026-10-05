/** Shown at once on navigation, while the next screen's route loads. The header stays up. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6"
    >
      <div className="h-9 w-48 animate-pulse rounded-md bg-surface" />
      <div className="h-4 w-64 animate-pulse rounded-md bg-surface" />
      <div className="mt-2 flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-surface" />
        ))}
      </div>
    </main>
  );
}
