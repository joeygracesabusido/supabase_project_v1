import { Link } from "react-router-dom";
import { Home, Search, ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-page)",
      }}
    >
      <header
        style={{
          background: "var(--bg-card)",
          borderBottom: "1px solid var(--border-color)",
          padding: "12px 24px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            to="/"
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#003580",
              textDecoration: "none",
              letterSpacing: -0.5,
            }}
          >
            EL Property
          </Link>
          <nav style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <Link
              to="/"
              style={{
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 48,
        }}
      >
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 12,
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--border-color)",
            padding: 64,
            textAlign: "center",
            maxWidth: 560,
            width: "100%",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "var(--bg-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
            }}
          >
            <Search size={28} style={{ color: "#0071C2" }} />
          </div>

          <h1
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: "#003580",
              margin: 0,
              lineHeight: 1,
            }}
          >
            404
          </h1>

          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "12px 0 8px",
            }}
          >
            Page not found
          </h2>

          <p
            style={{
              fontSize: 14,
              color: "var(--text-muted)",
              margin: "0 0 32px",
              lineHeight: 1.6,
            }}
          >
            The page you are looking for does not exist or has been moved.
            <br />
            Please check the URL or navigate back to your dashboard.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              to="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#003580",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#00224F")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#003580")
              }
            >
              <Home size={16} />
              Back to Dashboard
            </Link>
            <button
              type="button"
              onClick={() => window.history.back()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "var(--bg-muted)",
                color: "var(--text-secondary)",
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--border-color)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--bg-muted)")
              }
            >
              <ArrowLeft size={16} />
              Go Back
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
