/**
 * Chart colors, resolved per theme. Validated with the data-viz palette
 * checker against the chart surface in each mode:
 *   series   — lightness band, chroma floor, contrast ≥ 3:1
 *   status   — good / warning / critical, adjacent CVD ΔE ≥ 8 (light amber
 *              sits below 3:1 contrast, so status bars always carry value labels)
 * SVG presentation attributes don't resolve CSS variables, hence plain hex.
 */
export const CHART_THEME = {
  light: {
    surface: '#FFFDF9',
    series: '#9B3049',
    seriesWash: 'rgba(155, 48, 73, 0.10)',
    good: '#2F7A50',
    warning: '#C98A12',
    critical: '#B3364A',
    track: '#EFE9E0',
    grid: '#ECE6DC',
    axis: '#756F68',
    ink: '#1A1816',
  },
  dark: {
    surface: '#1B1815',
    series: '#C25E76',
    seriesWash: 'rgba(194, 94, 118, 0.12)',
    good: '#3E9E80',
    warning: '#BE8B1F',
    critical: '#E0607A',
    track: '#2E2924',
    grid: '#2E2924',
    axis: '#968F85',
    ink: '#F3EFE8',
  },
};

export const bandColor = (theme, score) => {
  if (score >= 75) return theme.good;
  if (score >= 55) return theme.warning;
  return theme.critical;
};
