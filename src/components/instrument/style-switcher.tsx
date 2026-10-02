import { APPARATUS_STYLES } from "./apparatus-styles";
import type { Appearance } from "./apparatus-styles";

function Silhouette({ style }: { style: Appearance }) {
  return (
    <svg
      viewBox="0 0 58 42"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden="true"
    >
      {style === "cyberpunk" ? (
        <>
          <path d="M16 3h24l4 5v28H13V7ZM12 38h34" />
          <path d="M17 9h23v15H17zM18 29h21M24 27v4" />
          <circle cx="28" cy="19" r="3" />
          <path d="M35 13h2M35 17h2M35 21h2M20 34h4M33 34h4" />
        </>
      ) : null}
      {style === "steampunk" ? (
        <>
          <rect x="7" y="33" width="45" height="7" rx="2" />
          <circle cx="24" cy="18" r="15" />
          <circle cx="24" cy="18" r="12" />
          <path d="m24 7 1 12-6 6M39 18h8m-5-3v6M49 7v19" />
          <circle cx="49" cy="28" r="2" />
          <path d="m18 37 2-3M11 5V2" />
        </>
      ) : null}
      {style === "soviet" ? (
        <>
          <rect x="13" y="7" width="33" height="33" rx="2" />
          <path d="M23 7V3h13v4M36 34h7" />
          {[19, 26, 33, 40].map((x) => (
            <rect key={x} x={x - 2.5} y="11" width="5" height="9" rx="2.5" />
          ))}
          <circle cx="23" cy="27" r="4" />
          <circle cx="37" cy="27" r="5" />
          <path d="m23 27 2-3" />
          <circle cx="22" cy="35" r="2.5" />
          <circle cx="29" cy="35" r="1.8" />
        </>
      ) : null}
      {style === "dieselpunk" ? (
        <>
          <rect x="13" y="6" width="29" height="12" rx="1" />
          <path d="M20 8v8M27 8v8M34 8v8M16 19v19h19V19M40 11h11v26H40Z" />
          <path d="M39 22h-4M39 28h-4M46 16v11m-3-11h6M21 33h10M19 6V2" />
          <circle cx="10" cy="25" r="7" />
          <path d="m10 25-4-3M10 25v5M10 25l5-2" />
        </>
      ) : null}
      {style === "arcane" ? (
        <>
          <rect x="14" y="35" width="31" height="5" rx="1" />
          <circle cx="29" cy="18" r="16" />
          <circle cx="29" cy="18" r="12" />
          <path d="m29 10 5 8-5 8-5-8ZM16 22l3 13M42 22l-3 13M12 14v16M29 2V0" />
          <path d="m12 30 2 3-2 3-2-3ZM20 28l2 2-2 2-2-2ZM29 30l2 2-2 2-2-2ZM38 28l2 2-2 2-2-2Z" />
        </>
      ) : null}
    </svg>
  );
}

export function StyleSwitcher({
  value,
  onChange,
}: {
  value: Appearance;
  onChange: (style: Appearance) => void;
}) {
  return (
    <div
      className="apparatus-picker"
      role="group"
      aria-label="Выбор устройства"
    >
      {APPARATUS_STYLES.map((style) => (
        <button
          key={style.id}
          type="button"
          className="apparatus-choice"
          data-variant={style.id}
          aria-pressed={style.id === value}
          onClick={() => onChange(style.id)}
          title={style.detail}
        >
          <Silhouette style={style.id} />
          <span>
            <strong>{style.name}</strong>
            <small>{style.detail}</small>
          </span>
          <i aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
