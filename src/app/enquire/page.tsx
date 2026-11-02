import Link from "next/link";
import { todayIST } from "@/domain/dates";
import EnquiryForm from "./enquiry-form";

export const metadata = { title: "Plan a gathering | Coffee Estate Resort" };
export default function EnquirePage() {
  return (
    <main className="page stack">
      <Link href="/">← Back to the estate</Link>
      <header className="stack">
        <p className="eyebrow">A place to come together</p>
        <h1>A quiet stay. A memorable gathering.</h1>
        <p className="lead">
          From a family escape to a celebration on the lawns, tell us what you have in mind. Our
          reservations and events teams will help with the details.
        </p>
      </header>
      <EnquiryForm today={todayIST()} />
    </main>
  );
}
