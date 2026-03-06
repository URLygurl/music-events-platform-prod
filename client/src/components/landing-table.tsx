import { useSettings } from "@/hooks/use-settings";

const COLS = [1, 2, 3, 4] as const;
const ROWS = [1, 2, 3, 4, 5, 6] as const;

export function LandingTable() {
  const { get } = useSettings();

  const showTable = get("landing_show_table", "true") === "true";
  if (!showTable) return null;

  const tableHeader = get("landing_table_header", "");
  const bgImage = get("bg_landing_table", "");

  const visibleCols = COLS.filter((c) => get(`landing_table_col${c}_show`, "true") === "true");

  if (visibleCols.length === 0) return null;

  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-black/20"
      style={
        bgImage
          ? {
              backgroundImage: `url(${bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { backgroundColor: "#ffffff" }
      }
      data-testid="landing-table"
    >
      {/* Optional header row */}
      {tableHeader && (
        <div className="px-3 py-2 border-b border-black/10 bg-white/80">
          <p className="text-xs font-semibold tracking-wide text-center">{tableHeader}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          {/* Column headers */}
          <thead>
            <tr>
              {visibleCols.map((c) => {
                const header = get(`landing_table_col${c}_header`, `Column ${c}`);
                return (
                  <th
                    key={c}
                    className="px-2 py-1.5 text-left font-semibold border-b border-black/10 bg-white/60 text-[11px] tracking-wide"
                    style={{ width: `${100 / visibleCols.length}%` }}
                  >
                    {header}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Data rows */}
          <tbody>
            {ROWS.map((r) => (
              <tr key={r} className="border-b border-black/5 last:border-0">
                {visibleCols.map((c) => {
                  const cellVal = get(`landing_table_r${r}c${c}`, "");
                  return (
                    <td
                      key={c}
                      className="px-2 py-1.5 align-top bg-white/40 text-[11px] leading-snug"
                    >
                      {cellVal || (
                        <span className="text-black/20 italic">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
