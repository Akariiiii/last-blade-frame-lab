type Value = string | number | boolean | null;
export function timingText(values: Record<string, Value> | undefined, field: string): string | null {
  if(!['Startup','Active','Recovery'].includes(field))return null;
  const value=values?.[field];
  if(typeof value==='number')return String(value);
  const bound=values?.StartupUpperBound;
  return field==='Startup'&&typeof bound==='number'?`≤${bound}`:null;
}
export function hasTimingValue(values: Record<string, Value> | undefined, field: string) {
  return timingText(values,field)!==null;
}
