export default function Loading() {
  return (
    <div className="screen" role="status">
      <p className="muted">Opening estate operations…</p>
      <div className="skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
