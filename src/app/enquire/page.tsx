import Link from "next/link";
import { todayIST } from "@/domain/dates";
import { GuestHeader } from "@/server/guest/ui";
import EnquiryForm from "./enquiry-form";

export const metadata = { title: "Plan a gathering | Coffee Estate Resort" };
export default function EnquirePage() {
  return (
    <>
      <GuestHeader />
      <main className="container page">
        <div className="split">
          <header>
            <Link href="/" className="text-link">
              Back to the estate
            </Link>
            <h1>A quiet stay. A memorable gathering.</h1>
            <p className="lead">
              From a family escape to a celebration on the lawns, tell us what you have in mind. Our
              reservations and events teams will help with the details.
            </p>
          </header>
          <EnquiryForm today={todayIST()} />
        </div>
      </main>
    </>
  );
}
