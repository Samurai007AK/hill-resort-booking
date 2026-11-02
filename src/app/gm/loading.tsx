export default function Loading() {
  return (
    <main className="container app screen" role="status">
      <p className="muted">Checking the estate’s live metrics…</p>
      <div className="skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
