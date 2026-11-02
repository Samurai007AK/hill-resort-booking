import Link from "next/link";
export default function NotFound() {
  return (
    <main className="page narrow stack">
      <p className="eyebrow">A DIFFERENT PATH</p>
      <h1>This page has wandered off.</h1>
      <p>Find a stay, explore our rooms, or send our team an enquiry.</p>
      <div className="actions">
        <Link className="button" href="/">
          Find a stay
        </Link>
        <Link href="/enquire">Contact the team</Link>
      </div>
    </main>
  );
}
