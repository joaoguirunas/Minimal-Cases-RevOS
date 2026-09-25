// src/lib/bi/squarify.ts
/** Treemap "squarified" (adaptado do Market Heatmap do 21st.dev): blocos com área proporcional ao valor. */
export interface Tile<T> { x: number; y: number; w: number; h: number; data: T }

function worst(row: number[], side: number, area: number) {
  const max = Math.max(...row), min = Math.min(...row);
  return Math.max((side * side * max) / (area * area), (area * area) / (side * side * min));
}

export function squarify<T>(items: { value: number; data: T }[], w: number, h: number): Tile<T>[] {
  const valid = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = valid.reduce((s, i) => s + i.value, 0);
  if (!total || w <= 0 || h <= 0) return [];
  const scale = (w * h) / total;
  const list = valid.map((i) => ({ area: i.value * scale, data: i.data }));
  const out: Tile<T>[] = [];
  let rx = 0, ry = 0, rw = w, rh = h, idx = 0;
  while (idx < list.length) {
    const side = Math.min(rw, rh);
    const row = [list[idx].area];
    const rowData = [list[idx].data];
    let rowArea = list[idx].area;
    let k = idx + 1;
    while (k < list.length) {
      const next = rowArea + list[k].area;
      if (worst([...row, list[k].area], side, next) > worst(row, side, rowArea)) break;
      row.push(list[k].area); rowData.push(list[k].data); rowArea = next; k++;
    }
    if (rw >= rh) {
      const colW = rowArea / rh;
      let cy = ry;
      row.forEach((a, j) => { const th = a / colW; out.push({ x: rx, y: cy, w: colW, h: th, data: rowData[j] }); cy += th; });
      rx += colW; rw -= colW;
    } else {
      const rowH = rowArea / rw;
      let cx = rx;
      row.forEach((a, j) => { const tw = a / rowH; out.push({ x: cx, y: ry, w: tw, h: rowH, data: rowData[j] }); cx += tw; });
      ry += rowH; rh -= rowH;
    }
    idx = k;
  }
  return out;
}
