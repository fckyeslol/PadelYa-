import { VP } from "./theme";

type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function VenuePageHeader({ title, subtitle, action }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      <div>
        {subtitle && (
          <p
            style={{
              margin: 0,
              fontSize: "0.78rem",
              color: VP.text3,
              textTransform: "capitalize",
            }}
          >
            {subtitle}
          </p>
        )}
        <h2
          style={{
            margin: subtitle ? "0.3rem 0 0" : 0,
            fontSize: "1.75rem",
            fontWeight: 700,
            fontFamily: VP.fontDisplay,
            color: VP.text,
            letterSpacing: "-0.025em",
          }}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
