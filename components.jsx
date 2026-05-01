
// ── FED-FinExcel Components ───────────────────────────────────────
// Shared UI components for the federal retirement planning app

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ── Formatting helpers ────────────────────────────────────────────
const fmt = {
  currency: (n, compact = false) => {
    if (n === undefined || n === null || isNaN(n)) return '—';
    if (compact && Math.abs(n) >= 1000000) return `$${(n/1000000).toFixed(2)}M`;
    if (compact && Math.abs(n) >= 1000) return `$${(n/1000).toFixed(0)}K`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  },
  pct: (n, decimals = 1) => isNaN(n) ? '—' : `${(n * 100).toFixed(decimals)}%`,
  num: (n) => isNaN(n) ? '—' : new Intl.NumberFormat('en-US').format(Math.round(n)),
  age: (n) => `Age ${n}`,
  year: (n) => `${n}`,
};

// ── Mini sparkline / bar chart (SVG) ─────────────────────────────
function Sparkline({ data, color = '#C9A84C', height = 48 }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 200, h = height;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.value - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── Line chart (SVG) ──────────────────────────────────────────────
function LineChart({ series, width = 600, height = 260, xKey = 'age', theme }) {
  if (!series || !series.length) return null;
  const pad = { t: 20, r: 20, b: 36, l: 64 };
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const allValues = series.flatMap(s => s.data.map(d => d.value));
  const minV = 0;
  const maxV = Math.max(...allValues) * 1.05 || 1;
  const xs = series[0].data.map(d => d.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  const toX = x => pad.l + ((x - minX) / (maxX - minX || 1)) * iw;
  const toY = v => pad.t + ih - ((v - minV) / (maxV - minV)) * ih;

  const colors = theme === 'dark'
    ? ['#C9A84C', '#4A90D9', '#5CB85C', '#E05353']
    : ['#1B3A6B', '#C9A84C', '#2E7D32', '#C62828'];

  // Y axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(f => ({ v: minV + f * (maxV - minV), f }));
  // X axis labels — show every 5 years
  const xTicks = xs.filter((x, i) => i === 0 || i === xs.length - 1 || x % 5 === 0);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {/* Grid */}
      {yTicks.map(t => (
        <line key={t.v} x1={pad.l} y1={toY(t.v)} x2={pad.l + iw} y2={toY(t.v)}
          stroke={theme === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'} strokeWidth="1" />
      ))}
      {/* Y labels */}
      {yTicks.map(t => (
        <text key={t.v} x={pad.l - 8} y={toY(t.v) + 4} textAnchor="end"
          fontSize="10" fill={theme === 'dark' ? '#8899AA' : '#667788'}>
          {fmt.currency(t.v, true)}
        </text>
      ))}
      {/* X labels */}
      {xTicks.map(x => (
        <text key={x} x={toX(x)} y={pad.t + ih + 20} textAnchor="middle"
          fontSize="10" fill={theme === 'dark' ? '#8899AA' : '#667788'}>
          {x}
        </text>
      ))}
      {/* Retire line */}
      {series[0]?.retireAge && (
        <>
          <line x1={toX(series[0].retireAge)} y1={pad.t} x2={toX(series[0].retireAge)} y2={pad.t + ih}
            stroke={theme === 'dark' ? 'rgba(201,168,76,0.4)' : 'rgba(27,58,107,0.3)'} strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={toX(series[0].retireAge) + 4} y={pad.t + 12} fontSize="9"
            fill={theme === 'dark' ? '#C9A84C' : '#1B3A6B'}>Retire</text>
        </>
      )}
      {/* Series lines */}
      {series.map((s, si) => {
        const pts = s.data.map(d => `${toX(d.x)},${toY(d.value)}`).join(' ');
        return (
          <polyline key={s.label} points={pts} fill="none"
            stroke={colors[si % colors.length]} strokeWidth="2.5" strokeLinejoin="round" />
        );
      })}
      {/* Legend */}
      {series.map((s, si) => (
        <g key={s.label} transform={`translate(${pad.l + si * 120}, ${height - 6})`}>
          <rect x="0" y="-8" width="10" height="3" fill={colors[si % colors.length]} rx="1" />
          <text x="14" y="0" fontSize="9" fill={theme === 'dark' ? '#AABBCC' : '#445566'}>{s.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Bar chart (SVG) ───────────────────────────────────────────────
function BarChart({ data, color = '#1B3A6B', accentColor = '#C9A84C', height = 200, theme }) {
  if (!data || !data.length) return null;
  const pad = { t: 16, r: 12, b: 32, l: 60 };
  const width = 400;
  const iw = width - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const maxV = Math.max(...data.map(d => d.value)) * 1.1 || 1;
  const barW = (iw / data.length) * 0.65;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 0.25, 0.5, 0.75, 1.0].map(f => {
        const y = pad.t + ih - f * ih;
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={pad.l + iw} y2={y}
              stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} strokeWidth="1" />
            <text x={pad.l - 6} y={y + 4} textAnchor="end" fontSize="9"
              fill={theme === 'dark' ? '#8899AA' : '#778899'}>
              {fmt.currency(maxV * f, true)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const bh = (d.value / maxV) * ih;
        const x = pad.l + i * (iw / data.length) + (iw / data.length - barW) / 2;
        const y = pad.t + ih - bh;
        const c = d.accent ? accentColor : color;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={bh} fill={c} rx="2" opacity="0.9" />
            <text x={x + barW / 2} y={pad.t + ih + 16} textAnchor="middle" fontSize="9"
              fill={theme === 'dark' ? '#AABBCC' : '#556677'}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Metric Card ───────────────────────────────────────────────────
function MetricCard({ label, value, sub, trend, accent, style: cardStyle, theme }) {
  const isDark = theme === 'dark';
  return (
    <div style={{
      background: isDark ? (accent ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)') : (accent ? 'rgba(27,58,107,0.06)' : '#FFFFFF'),
      border: `1px solid ${isDark ? (accent ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.08)') : (accent ? 'rgba(27,58,107,0.2)' : '#E8ECF0')}`,
      borderRadius: 8,
      padding: '16px 20px',
      ...cardStyle
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: isDark ? '#8899BB' : '#7788AA', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: isDark ? '#E8F0FF' : '#0F1F3C',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: isDark ? '#6677AA' : '#8899BB', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────
function SectionHeader({ title, subtitle, theme }) {
  const isDark = theme === 'dark';
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700,
        color: isDark ? '#E8F0FF' : '#0F1F3C', letterSpacing: '-0.02em' }}>{title}</h2>
      {subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: isDark ? '#8899BB' : '#667799' }}>{subtitle}</p>}
    </div>
  );
}

// ── Alert Banner ──────────────────────────────────────────────────
function Alert({ type = 'info', children, theme }) {
  const isDark = theme === 'dark';
  const colors = {
    warning: { bg: isDark ? 'rgba(201,168,76,0.12)' : '#FFFBEB', border: '#C9A84C', icon: '⚠', text: isDark ? '#D4B85C' : '#92620A' },
    success: { bg: isDark ? 'rgba(72,160,90,0.1)' : '#F0FAF2', border: '#48A05A', icon: '✓', text: isDark ? '#5CB870' : '#1B5E20' },
    info:    { bg: isDark ? 'rgba(74,144,217,0.1)' : '#EFF6FF', border: '#4A90D9', icon: 'ℹ', text: isDark ? '#5599DD' : '#1345A0' },
    danger:  { bg: isDark ? 'rgba(220,53,69,0.1)' : '#FFF0F0', border: '#DC3545', icon: '✕', text: isDark ? '#E05353' : '#B71C1C' },
  };
  const c = colors[type];
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 6,
      padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
      <span style={{ color: c.border, fontWeight: 700, flexShrink: 0 }}>{c.icon}</span>
      <span style={{ fontSize: 13, color: c.text, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────
function ProgressBar({ value, max = 1, color = '#1B3A6B', theme }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const isDark = theme === 'dark';
  return (
    <div style={{ background: isDark ? 'rgba(255,255,255,0.08)' : '#E8ECF2', borderRadius: 4, height: 8, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4,
        transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ── Input Field ───────────────────────────────────────────────────
function Field({ label, help, type = 'text', value, onChange, prefix, suffix, options, theme }) {
  const isDark = theme === 'dark';
  const baseInput = {
    width: '100%', boxSizing: 'border-box', padding: '8px 12px',
    fontSize: 14, borderRadius: 6, outline: 'none', fontFamily: 'inherit',
    background: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#CBD5E0'}`,
    color: isDark ? '#E0ECFF' : '#0F1F3C',
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: isDark ? '#8899BB' : '#556688',
        letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefix && <span style={{ position: 'absolute', left: 10, color: isDark ? '#6677AA' : '#8899AA',
          fontSize: 13, fontWeight: 500, pointerEvents: 'none' }}>{prefix}</span>}
        {options ? (
          <select value={value} onChange={e => onChange(e.target.value)}
            style={{ ...baseInput, paddingLeft: prefix ? 22 : 12, appearance: 'none',
              cursor: 'pointer' }}>
            {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
          </select>
        ) : (
          <input type={type} value={value} onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            style={{ ...baseInput, paddingLeft: prefix ? 22 : 12, paddingRight: suffix ? 32 : 12 }} />
        )}
        {suffix && <span style={{ position: 'absolute', right: 10, color: isDark ? '#6677AA' : '#8899AA',
          fontSize: 13, pointerEvents: 'none' }}>{suffix}</span>}
      </div>
      {help && <div style={{ fontSize: 11, color: isDark ? '#5566AA' : '#8899BB', marginTop: 3, lineHeight: 1.4 }}>{help}</div>}
    </div>
  );
}

// ── Slider Field ──────────────────────────────────────────────────
function SliderField({ label, min, max, step = 1, value, onChange, fmt: fmtFn, theme }) {
  const isDark = theme === 'dark';
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#8899BB' : '#556688',
          letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</label>
        <span style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#C9A84C' : '#1B3A6B' }}>
          {fmtFn ? fmtFn(value) : value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: isDark ? '#C9A84C' : '#1B3A6B' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 10, color: isDark ? '#445566' : '#AABBCC' }}>{fmtFn ? fmtFn(min) : min}</span>
        <span style={{ fontSize: 10, color: isDark ? '#445566' : '#AABBCC' }}>{fmtFn ? fmtFn(max) : max}</span>
      </div>
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────
function DataTable({ columns, rows, theme, compact }) {
  const isDark = theme === 'dark';
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? 12 : 13 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{
                textAlign: c.align || 'left', padding: compact ? '6px 8px' : '8px 12px',
                borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#D0D8E4'}`,
                fontWeight: 700, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                color: isDark ? '#7788AA' : '#667799', whiteSpace: 'nowrap'
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{
              background: i % 2 === 0 ? 'transparent' :
                (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
            }}>
              {columns.map(c => (
                <td key={c.key} style={{
                  padding: compact ? '5px 8px' : '8px 12px',
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : '#EDF0F5'}`,
                  textAlign: c.align || 'left',
                  color: isDark ? '#C8D8F0' : '#2A3D5C',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: row[c.key + '_bold'] ? 700 : 400,
                }}>{row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Donut chart (SVG) ─────────────────────────────────────────────
function DonutChart({ segments, size = 120, thickness = 22, theme }) {
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#EDF0F5'}
        strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circumference;
        const gap = circumference - dash;
        const el = (
          <circle key={seg.label} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={thickness - 2}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset + circumference / 4}
            style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}

// Export to global scope
Object.assign(window, {
  fmt, Sparkline, LineChart, BarChart, MetricCard, SectionHeader,
  Alert, ProgressBar, Field, SliderField, DataTable, DonutChart
});
