import { useState } from "react";
import { useSettings } from "@/hooks/use-settings";

const COLS = [1, 2, 3, 4] as const;
const ROWS = [1, 2, 3, 4, 5, 6] as const;

export function LandingTable() {
  const { get } = useSettings();
  const [failedImage, setFailedImage] = useState<string | null>(null);

  const showTable = get("landing_show_table", "true") === "true";
  if (!showTable) return null;

  const tableHeader = get("landing_table_header", "");
  const bgImage = get("bg_landing_table", "");

  const image = get("landing_table_image", "");
  const showImage = get("landing_table_mode", "table") === "image" && !!image && failedImage !== image;
  const selectedCols = COLS.filter((c) => get(`landing_table_col${c}_show`, "true") === "true");

  if (selectedCols.length === 0 && !showImage) return null;
  const visibleCols = selectedCols.length ? selectedCols : COLS;

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-black/20"
      style={
        bgImage && !showImage
          ? {
              backgroundImage: `url(${bgImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { backgroundColor: "#ffffff" }
      }
      data-testid="landing-table"
    >
      {/* Keep the original layout as a sizing template, not a second visible table. */}
      <div
        style={showImage ? { visibility: "hidden" } : undefined}
        aria-hidden={showImage || undefined}
        data-testid="landing-table-content"
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
      {showImage && (
        <img
          src={image}
          alt={tableHeader || "What's on"}
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setFailedImage(image)}
          data-testid="landing-table-image"
        />
      )}
    </div>
  );
}
