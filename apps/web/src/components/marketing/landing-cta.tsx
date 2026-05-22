import Link from "next/link"

export function LandingCTA() {
  return (
    <section style={{ backgroundColor: "#272729" }}>
      <div className="mx-auto max-w-[1440px] px-8 py-[80px] text-center">
        <h2
          className="mx-auto text-balance"
          style={{
            fontSize: "clamp(40px, 4vw, 56px)",
            fontWeight: 600,
            lineHeight: 1.07,
            letterSpacing: "-0.28px",
            color: "#ffffff",
            maxWidth: "560px"
          }}
        >
          Start tracking the queue.
        </h2>

        <p
          className="mx-auto mt-5"
          style={{
            fontSize: "21px",
            fontWeight: 400,
            lineHeight: "1.19",
            letterSpacing: "0.231px",
            color: "#cccccc",
            maxWidth: "480px"
          }}
        >
          Free while we&apos;re in beta. Sign in with Google, or use your work
          email — no password to set up.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center transition-transform active:scale-95"
            style={{
              backgroundColor: "#0066cc",
              color: "#ffffff",
              borderRadius: "9999px",
              padding: "14px 28px",
              fontSize: "18px",
              fontWeight: 300,
              lineHeight: 1,
              textDecoration: "none"
            }}
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center transition-transform active:scale-95"
            style={{
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#2997ff",
              backgroundColor: "transparent",
              borderRadius: "9999px",
              padding: "14px 28px",
              fontSize: "18px",
              fontWeight: 300,
              lineHeight: 1,
              textDecoration: "none"
            }}
          >
            I already have an account
          </Link>
        </div>
      </div>
    </section>
  )
}
