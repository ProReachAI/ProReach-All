import Image from "next/image";

export function ProReachLogo({ compact = false, light = false, size = 40 }: {
  compact?: boolean;
  light?: boolean;
  size?: number;
}) {
  return (
    <span className={`proreach-logo${light ? " is-light" : ""}${compact ? " is-compact" : ""}`}>
      <span className="proreach-logo-mark" style={{ width: size, height: size }}>
        <Image src="/proreach-mark.svg" alt="" width={size} height={size} priority={size >= 40} />
      </span>
      {!compact && <span className="proreach-logo-type"><strong>ProReach</strong><small>Marketing agent</small></span>}
    </span>
  );
}
