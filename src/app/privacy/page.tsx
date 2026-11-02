import { GuestHeader } from "@/server/guest/ui";

export default function PrivacyPage() {
  return (
    <>
      <GuestHeader />
      <main className="container page">
        <article className="prose">
          <h1>Privacy, kept simple.</h1>
          <section>
            <h2>What we collect</h2>
            <p>
              Booking forms collect your name, contact details, stay dates and party size. Enquiry
              forms collect the information you choose to share. Please use fictional details in
              this demonstration and never submit identity documents or payment-card information.
            </p>
          </section>
          <section>
            <h2>Why we use it</h2>
            <p>
              Resort staff use these details to manage bookings and reply to enquiries. Booking
              requires your explicit consent. Enquiry messages are checked for contact and
              identity-number patterns before classification; only redacted message text is sent to
              the configured model provider. Staff review every draft before sending a reply.
            </p>
          </section>
          <section>
            <h2>Who can see it</h2>
            <p>
              Authorised reservations, sales and management users can see the information needed to
              handle your request. Your private booking pages require a signed browser cookie that
              expires after twenty-four hours.
            </p>
          </section>
          <section>
            <h2>How long it stays</h2>
            <p>
              This is a shared demonstration environment. A manager can reset demo bookings and
              enquiries at any time. No production retention schedule is claimed; retention,
              deletion and consent-withdrawal procedures must be agreed before accepting real guest
              data.
            </p>
          </section>
          <section>
            <h2>Identity and payments</h2>
            <p>
              Passport and Form C details are taken at check-in, never online. TestPay simulates
              payment without collecting card details or transferring money.
            </p>
          </section>
          <section>
            <h2>Questions or deletion requests</h2>
            <p>
              Use the enquiry form to ask the resort team about a booking or request deletion.
              Include only your booking reference and a contact address, not identity documents.
            </p>
          </section>
        </article>
      </main>
    </>
  );
}
