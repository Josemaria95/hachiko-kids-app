import { Circle, Ellipse, Line, Path, Polygon, Svg } from "react-native-svg";
import type { PetMood } from "../lib/pet-reactions";
import type { MascotColor } from "../lib/types/database";

const LUNA_PALETTE: Record<MascotColor, { body: string; ear: string; accent: string; blush: string; inner: string }> = {
  purple: { body: "#D4CCFF", ear: "#E8E4FF", accent: "#7B61FF", blush: "#C4B5FD", inner: "#EDE9FF" },
  blue:   { body: "#BFDBFE", ear: "#DBEAFE", accent: "#3B82F6", blush: "#93C5FD", inner: "#EFF6FF" },
  green:  { body: "#A7F3D0", ear: "#D1FAE5", accent: "#059669", blush: "#6EE7B7", inner: "#ECFDF5" },
  pink:   { body: "#FBCFE8", ear: "#FCE7F3", accent: "#DB2777", blush: "#F9A8D4", inner: "#FDF2F8" },
  orange: { body: "#FED7AA", ear: "#FFEDD5", accent: "#EA580C", blush: "#FDBA74", inner: "#FFF7ED" },
};

export const GLOW_COLORS: Record<MascotColor, string> = {
  purple: "#C4BCFF",
  blue:   "#93C5FD",
  green:  "#6EE7B7",
  pink:   "#F9A8D4",
  orange: "#FDBA74",
};

interface Props {
  mood: PetMood;
  colorKey: MascotColor;
  size: number;
}

export default function LunaSvg({ mood, colorKey, size }: Props) {
  const p = LUNA_PALETTE[colorKey] ?? LUNA_PALETTE.purple;
  const s = size;
  const cx = s / 2;
  const cy = s / 2 + s * 0.04;

  const bodyW = s * 0.52;
  const bodyH = s * 0.44;
  const bodyX = cx;
  const bodyY = cy + s * 0.22;

  const headR = s * 0.3;
  const headCX = cx;
  const headCY = cy + s * 0.02;

  const eyeLX = headCX - headR * 0.36;
  const eyeRX = headCX + headR * 0.36;
  const eyeY = headCY - headR * 0.04;

  const noseY = headCY + headR * 0.3;
  const wY = noseY + s * 0.01;

  // ── Eyes ──────────────────────────────────────────────────────────────────
  function renderEyes() {
    if (mood === "happy") {
      const sw = s * 0.025;
      return (
        <>
          {/* Left eye arc */}
          <Path
            d={`M${eyeLX - s * 0.055} ${eyeY} Q${eyeLX} ${eyeY - s * 0.07} ${eyeLX + s * 0.055} ${eyeY}`}
            stroke={p.accent} strokeWidth={sw} fill="none" strokeLinecap="round"
          />
          {/* Right eye arc */}
          <Path
            d={`M${eyeRX - s * 0.055} ${eyeY} Q${eyeRX} ${eyeY - s * 0.07} ${eyeRX + s * 0.055} ${eyeY}`}
            stroke={p.accent} strokeWidth={sw} fill="none" strokeLinecap="round"
          />
          {/* Blush */}
          <Ellipse cx={eyeLX} cy={eyeY + s * 0.055} rx={s * 0.055} ry={s * 0.03} fill={p.blush} opacity={0.65} />
          <Ellipse cx={eyeRX} cy={eyeY + s * 0.055} rx={s * 0.055} ry={s * 0.03} fill={p.blush} opacity={0.65} />
        </>
      );
    }

    if (mood === "sad") {
      return (
        <>
          {/* Eyes */}
          <Ellipse cx={eyeLX} cy={eyeY} rx={s * 0.055} ry={s * 0.065} fill={p.accent} />
          <Ellipse cx={eyeLX - s * 0.012} cy={eyeY - s * 0.015} rx={s * 0.03} ry={s * 0.038} fill="white" />
          <Ellipse cx={eyeRX} cy={eyeY} rx={s * 0.055} ry={s * 0.065} fill={p.accent} />
          <Ellipse cx={eyeRX - s * 0.012} cy={eyeY - s * 0.015} rx={s * 0.03} ry={s * 0.038} fill="white" />
          {/* Tear */}
          <Ellipse cx={eyeLX - s * 0.01} cy={eyeY + s * 0.08} rx={s * 0.015} ry={s * 0.025} fill="#93C5FD" opacity={0.8} />
          {/* Sad brows */}
          <Path
            d={`M${eyeLX - s * 0.05} ${eyeY - s * 0.1} L${eyeLX + s * 0.04} ${eyeY - s * 0.075}`}
            stroke={p.accent} strokeWidth={s * 0.022} strokeLinecap="round" fill="none"
          />
          <Path
            d={`M${eyeRX - s * 0.04} ${eyeY - s * 0.075} L${eyeRX + s * 0.05} ${eyeY - s * 0.1}`}
            stroke={p.accent} strokeWidth={s * 0.022} strokeLinecap="round" fill="none"
          />
        </>
      );
    }

    if (mood === "angry") {
      return (
        <>
          {/* Eyes */}
          <Ellipse cx={eyeLX} cy={eyeY} rx={s * 0.055} ry={s * 0.055} fill={p.accent} />
          <Ellipse cx={eyeLX - s * 0.01} cy={eyeY - s * 0.01} rx={s * 0.03} ry={s * 0.03} fill="white" />
          <Ellipse cx={eyeRX} cy={eyeY} rx={s * 0.055} ry={s * 0.055} fill={p.accent} />
          <Ellipse cx={eyeRX - s * 0.01} cy={eyeY - s * 0.01} rx={s * 0.03} ry={s * 0.03} fill="white" />
          {/* V brows */}
          <Path
            d={`M${eyeLX - s * 0.055} ${eyeY - s * 0.09} L${eyeLX + s * 0.045} ${eyeY - s * 0.12}`}
            stroke={p.accent} strokeWidth={s * 0.028} strokeLinecap="round" fill="none"
          />
          <Path
            d={`M${eyeRX - s * 0.045} ${eyeY - s * 0.12} L${eyeRX + s * 0.055} ${eyeY - s * 0.09}`}
            stroke={p.accent} strokeWidth={s * 0.028} strokeLinecap="round" fill="none"
          />
        </>
      );
    }

    if (mood === "scared") {
      return (
        <>
          {/* Big eyes */}
          <Ellipse cx={eyeLX} cy={eyeY} rx={s * 0.07} ry={s * 0.08} fill={p.accent} />
          <Ellipse cx={eyeLX - s * 0.015} cy={eyeY - s * 0.015} rx={s * 0.04} ry={s * 0.045} fill="white" />
          <Ellipse cx={eyeRX} cy={eyeY} rx={s * 0.07} ry={s * 0.08} fill={p.accent} />
          <Ellipse cx={eyeRX - s * 0.015} cy={eyeY - s * 0.015} rx={s * 0.04} ry={s * 0.045} fill="white" />
          {/* Raised brows */}
          <Path
            d={`M${eyeLX - s * 0.055} ${eyeY - s * 0.12} Q${eyeLX} ${eyeY - s * 0.15} ${eyeLX + s * 0.055} ${eyeY - s * 0.12}`}
            stroke={p.accent} strokeWidth={s * 0.022} strokeLinecap="round" fill="none"
          />
          <Path
            d={`M${eyeRX - s * 0.055} ${eyeY - s * 0.12} Q${eyeRX} ${eyeY - s * 0.15} ${eyeRX + s * 0.055} ${eyeY - s * 0.12}`}
            stroke={p.accent} strokeWidth={s * 0.022} strokeLinecap="round" fill="none"
          />
        </>
      );
    }

    // neutral
    return (
      <>
        <Ellipse cx={eyeLX} cy={eyeY} rx={s * 0.055} ry={s * 0.065} fill={p.accent} />
        <Ellipse cx={eyeLX - s * 0.012} cy={eyeY - s * 0.015} rx={s * 0.028} ry={s * 0.035} fill="white" />
        <Ellipse cx={eyeRX} cy={eyeY} rx={s * 0.055} ry={s * 0.065} fill={p.accent} />
        <Ellipse cx={eyeRX - s * 0.012} cy={eyeY - s * 0.015} rx={s * 0.028} ry={s * 0.035} fill="white" />
      </>
    );
  }

  // ── Mouth ─────────────────────────────────────────────────────────────────
  function renderMouth() {
    const sw = s * 0.022;
    if (mood === "happy") {
      return (
        <Path
          d={`M${headCX - s * 0.055} ${noseY + s * 0.035} Q${headCX} ${noseY + s * 0.085} ${headCX + s * 0.055} ${noseY + s * 0.035}`}
          stroke={p.accent} strokeWidth={sw} fill="none" strokeLinecap="round"
        />
      );
    }
    if (mood === "sad" || mood === "angry") {
      return (
        <Path
          d={`M${headCX - s * 0.055} ${noseY + s * 0.065} Q${headCX} ${noseY + s * 0.025} ${headCX + s * 0.055} ${noseY + s * 0.065}`}
          stroke={p.accent} strokeWidth={sw} fill="none" strokeLinecap="round"
        />
      );
    }
    if (mood === "scared") {
      return (
        <Ellipse cx={headCX} cy={noseY + s * 0.06} rx={s * 0.03} ry={s * 0.03} fill={p.accent} opacity={0.8} />
      );
    }
    // neutral — straight line
    return (
      <Path
        d={`M${headCX - s * 0.05} ${noseY + s * 0.045} L${headCX + s * 0.05} ${noseY + s * 0.045}`}
        stroke={p.accent} strokeWidth={sw} fill="none" strokeLinecap="round"
      />
    );
  }

  // Ear polygon points
  const earLBack = `${headCX - headR * 0.55},${headCY - headR * 0.75} ${headCX - headR * 0.2},${headCY - headR * 1.25} ${headCX + headR * 0.05},${headCY - headR * 0.7}`;
  const earRBack = `${headCX + headR * 0.55},${headCY - headR * 0.75} ${headCX + headR * 0.2},${headCY - headR * 1.25} ${headCX - headR * 0.05},${headCY - headR * 0.7}`;
  const earLInner = `${headCX - headR * 0.5},${headCY - headR * 0.72} ${headCX - headR * 0.22},${headCY - headR * 1.12} ${headCX + headR * 0.0},${headCY - headR * 0.68}`;
  const earRInner = `${headCX + headR * 0.5},${headCY - headR * 0.72} ${headCX + headR * 0.22},${headCY - headR * 1.12} ${headCX - headR * 0.0},${headCY - headR * 0.68}`;

  const sw = s * 0.014;

  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      {/* Tail */}
      <Path
        d={`M${cx + bodyW * 0.45} ${bodyY + bodyH * 0.1} Q${cx + bodyW * 0.9} ${bodyY - bodyH * 0.2} ${cx + bodyW * 0.75} ${bodyY - bodyH * 0.5}`}
        stroke={p.body} strokeWidth={s * 0.09} fill="none" strokeLinecap="round" opacity={0.9}
      />
      <Path
        d={`M${cx + bodyW * 0.45} ${bodyY + bodyH * 0.1} Q${cx + bodyW * 0.9} ${bodyY - bodyH * 0.2} ${cx + bodyW * 0.75} ${bodyY - bodyH * 0.5}`}
        stroke={p.accent} strokeWidth={s * 0.04} fill="none" strokeLinecap="round" opacity={0.25}
      />

      {/* Body */}
      <Ellipse cx={bodyX} cy={bodyY} rx={bodyW} ry={bodyH} fill={p.body} />

      {/* Belly */}
      <Ellipse cx={bodyX} cy={bodyY + bodyH * 0.1} rx={bodyW * 0.55} ry={bodyH * 0.6} fill={p.inner} opacity={0.7} />

      {/* Ears back */}
      <Polygon points={earLBack} fill={p.ear} />
      <Polygon points={earRBack} fill={p.ear} />

      {/* Head */}
      <Circle cx={headCX} cy={headCY} r={headR} fill={p.body} />

      {/* Ear inner */}
      <Polygon points={earLInner} fill={p.accent} opacity={0.35} />
      <Polygon points={earRInner} fill={p.accent} opacity={0.35} />

      {/* Eyes */}
      {renderEyes()}

      {/* Whiskers */}
      <Line x1={headCX - s * 0.06} y1={wY - s * 0.015} x2={headCX - s * 0.22} y2={wY - s * 0.03} stroke={p.accent} strokeWidth={sw} strokeLinecap="round" opacity={0.5} />
      <Line x1={headCX - s * 0.06} y1={wY + s * 0.015} x2={headCX - s * 0.22} y2={wY + s * 0.02} stroke={p.accent} strokeWidth={sw} strokeLinecap="round" opacity={0.5} />
      <Line x1={headCX + s * 0.06} y1={wY - s * 0.015} x2={headCX + s * 0.22} y2={wY - s * 0.03} stroke={p.accent} strokeWidth={sw} strokeLinecap="round" opacity={0.5} />
      <Line x1={headCX + s * 0.06} y1={wY + s * 0.015} x2={headCX + s * 0.22} y2={wY + s * 0.02} stroke={p.accent} strokeWidth={sw} strokeLinecap="round" opacity={0.5} />

      {/* Nose */}
      <Ellipse cx={headCX} cy={noseY} rx={s * 0.032} ry={s * 0.022} fill={p.accent} opacity={0.9} />

      {/* Mouth */}
      {renderMouth()}
    </Svg>
  );
}
