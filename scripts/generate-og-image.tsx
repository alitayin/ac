import fs from "node:fs/promises";
import path from "node:path";
import React from "react";
import { ImageResponse } from "next/og";

const width = 1200;
const height = 630;

const rows = [
  {
    rank: "1",
    name: "Staked XEC",
    price: "1.00",
    change: "+0.00%",
    volume24h: "355.80M XEC",
    volume7d: "7.073B XEC",
    volume30d: "19.620B XEC",
    sales: "672",
    accent: "#2563EB",
    badge: "SX",
  },
  {
    rank: "2",
    name: "Firma",
    price: "141243.11",
    change: "+0.88%",
    volume24h: "215.18M XEC",
    volume7d: "829.07M XEC",
    volume30d: "4.587B XEC",
    sales: "79",
    accent: "#334155",
    badge: "FI",
  },
  {
    rank: "3",
    name: "Blockchain Ventures Equity",
    price: "209537.58",
    change: "+0.00%",
    volume24h: "0.00 XEC",
    volume7d: "2.30M XEC",
    volume30d: "53.85M XEC",
    sales: "2",
    accent: "#0F172A",
    badge: "BV",
  },
  {
    rank: "4",
    name: "ProofofWriting.com Token",
    price: "3998.00",
    change: "+0.00%",
    volume24h: "223,888.01 XEC",
    volume7d: "1.90M XEC",
    volume30d: "13.01M XEC",
    sales: "37",
    accent: "#E5E7EB",
    badge: "PW",
    darkBadge: true,
  },
  {
    rank: "5",
    name: "VCASH",
    price: "1.35",
    change: "+42.10%",
    volume24h: "1.03M XEC",
    volume7d: "1.03M XEC",
    volume30d: "1.03M XEC",
    sales: "20",
    accent: "#111827",
    badge: "VC",
  },
];

const rootDir = process.cwd();
const outputPath = path.join(rootDir, "public/og-image.png");

function Pill({ children, active = false, width: pillWidth }: { children: React.ReactNode; active?: boolean; width?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 36,
        width: pillWidth,
        padding: "0 16px",
        borderRadius: 10,
        border: active ? "none" : "1px solid #D7E1EF",
        background: active ? "linear-gradient(135deg, #4274FF, #5A8CFF)" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#475569",
        fontSize: 15,
        fontWeight: 700,
      }}
    >
      {children}
    </div>
  );
}

function ToolButton({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        borderRadius: 10,
        border: "1px solid #D7E1EF",
        background: "#FFFFFF",
        color: "#475569",
        fontSize: 16,
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}

function HeaderCell({ label, width: cellWidth }: { label: string; width: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: cellWidth,
        color: "#64748B",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}

function TableRow({
  rank,
  name,
  price,
  change,
  volume24h,
  volume7d,
  volume30d,
  sales,
  accent,
  badge,
  darkBadge,
}: (typeof rows)[number]) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: 58,
        borderTop: "1px solid #EEF2F7",
        color: "#1F2937",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      <div style={{ display: "flex", width: 36 }}>{rank}</div>
      <div style={{ display: "flex", alignItems: "center", width: 316 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            marginRight: 14,
            borderRadius: 9999,
            background: accent,
            color: darkBadge ? "#111827" : "#FFFFFF",
            border: darkBadge ? "1px solid #CBD5E1" : "none",
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {badge}
        </div>
        <div style={{ display: "flex", maxWidth: 272 }}>{name}</div>
      </div>
      <div style={{ display: "flex", width: 104, color: "#334155" }}>{price}</div>
      <div style={{ display: "flex", width: 96, color: "#5BC17B", fontWeight: 700 }}>{change}</div>
      <div style={{ display: "flex", width: 138 }}>{volume24h}</div>
      <div style={{ display: "flex", width: 138 }}>{volume7d}</div>
      <div style={{ display: "flex", width: 144 }}>{volume30d}</div>
      <div style={{ display: "flex", width: 50 }}>{sales}</div>
    </div>
  );
}

async function main() {
  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #FAFBFD 0%, #EEF3FF 100%)",
          fontFamily: "Geist Sans",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -36,
            right: -24,
            width: 176,
            height: 176,
            borderRadius: 9999,
            background: "rgba(220, 231, 255, 0.62)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 20,
            bottom: -70,
            width: 244,
            height: 244,
            borderRadius: 9999,
            background: "rgba(231, 239, 255, 0.72)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 250,
            bottom: -36,
            width: 160,
            height: 160,
            borderRadius: 9999,
            background: "rgba(243, 233, 255, 0.52)",
          }}
        />

        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 64,
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 38px",
            background: "rgba(255, 255, 255, 0.88)",
            borderBottom: "1px solid #E8EDF5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", color: "#0F172A", fontSize: 24, fontWeight: 800 }}>Agora Cash</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 52,
                height: 28,
                borderRadius: 8,
                background: "#E7EFFF",
                color: "#4B6BFB",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              4.0.9
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 132,
              height: 44,
              borderRadius: 12,
              border: "2px solid #D8E4FF",
              background: "#FFFFFF",
              color: "#1E293B",
              fontSize: 21,
              fontWeight: 700,
            }}
          >
            Swap
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 22, height: 22, borderRadius: 9999, border: "2px solid #D6E1F5", background: "#FFFFFF" }} />
              <div style={{ width: 22, height: 22, borderRadius: 9999, border: "2px solid #D6E1F5", background: "#FFFFFF" }} />
              <div style={{ width: 22, height: 22, borderRadius: 9999, border: "2px solid #7AA1FF", background: "#FFFFFF" }} />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 40,
                padding: "0 14px",
                borderRadius: 9999,
                border: "1px solid #E2E8F0",
                background: "#F8FAFD",
                color: "#475569",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              <span>ejt978</span>
              <span
                style={{
                  display: "flex",
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: "#5EC46A",
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            padding: "84px 82px 54px",
          }}
        >
          <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
            <Pill active width={108}>Token Table</Pill>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Pill width={164}>Real-time eToken Flow</Pill>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  marginLeft: -34,
                  borderRadius: 6,
                  background: "#F1F5F9",
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                4
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              borderRadius: 20,
              border: "1px solid #E2E8F0",
              background: "linear-gradient(180deg, #FFFFFF 0%, #FCFDFF 100%)",
              boxShadow: "0 14px 36px rgba(162, 182, 230, 0.18)",
              padding: "28px 36px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ display: "flex", color: "#111827", fontSize: 30, fontWeight: 800 }}>eToken Market</div>
                  <div style={{ display: "flex", color: "#94A3B8", fontSize: 18, fontWeight: 700 }}>#945,620</div>
                </div>
                <div style={{ display: "flex", marginTop: 6, color: "#64748B", fontSize: 18, fontWeight: 500 }}>
                  Agora sales data. Showing the 100 tokens with the highest 7-day trading volume.
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Pill width={160}>7D Active Tokens</Pill>
                <Pill width={110}>All eTokens</Pill>
                <ToolButton label="F" />
                <ToolButton label="S" />
                <ToolButton label="R" />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 18,
                height: 42,
                alignItems: "center",
                borderTop: "1px solid #E5EAF2",
                borderBottom: "1px solid #E5EAF2",
                color: "#64748B",
              }}
            >
              <HeaderCell width={36} label="#" />
              <HeaderCell width={316} label="Name" />
              <HeaderCell width={104} label="Price (XEC)" />
              <HeaderCell width={96} label="24h Change" />
              <HeaderCell width={138} label="24h Volume" />
              <HeaderCell width={138} label="7D Volume" />
              <HeaderCell width={144} label="30D Volume" />
              <HeaderCell width={50} label="Sales" />
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {rows.map((row) => (
                <TableRow key={row.rank} {...row} />
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
    },
  );

  const buffer = Buffer.from(await image.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  console.log(`Generated ${path.relative(rootDir, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
