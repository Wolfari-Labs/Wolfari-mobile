import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

/** Dark runs per row, so a 25×25 code renders as ~150 Views instead of 625. */
export function qrRuns(text: string): { size: number; rows: [number, number][][] } {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  const size = code.getModuleCount();
  const rows: [number, number][][] = [];
  for (let row = 0; row < size; row++) {
    const runs: [number, number][] = [];
    let start = -1;
    for (let col = 0; col <= size; col++) {
      const dark = col < size && code.isDark(row, col);
      if (dark && start < 0) start = col;
      if (!dark && start >= 0) {
        runs.push([start, col - start]);
        start = -1;
      }
    }
    rows.push(runs);
  }
  return { size, rows };
}

export function InviteQr({ value, size = 196, label }: { value: string; size?: number; label: string }) {
  const matrix = useMemo(() => qrRuns(value), [value]);
  const quiet = 4;
  const cell = size / (matrix.size + quiet * 2);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.frame, { width: size, height: size }]}>
      {matrix.rows.map((runs, row) =>
        runs.map(([start, length]) => (
          <View
            key={`${row}:${start}`}
            style={{
              position: "absolute",
              top: (row + quiet) * cell,
              left: (start + quiet) * cell,
              width: length * cell + 0.5,
              height: cell + 0.5,
              backgroundColor: "#0B1F33",
            }}
          />
        )),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", alignSelf: "center" },
});
