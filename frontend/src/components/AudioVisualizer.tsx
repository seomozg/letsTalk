interface AudioVisualizerProps {
  isActive: boolean;
  state: "idle" | "listening" | "speaking";
  data?: number[];
  sensitivity?: number;
}

export function AudioVisualizer({ isActive, state, data = [], sensitivity = 1 }: AudioVisualizerProps) {
  const bars = 22;
  const baseHeight = 6;
  const maxHeight = 72;

  const getBarColor = () => {
    switch (state) {
      case "listening":
        return "bg-blue-500";
      case "speaking":
        return "bg-green-500";
      default:
        return "bg-gray-400";
    }
  };

  const getBins = () => {
    if (!data.length) {
      return Array.from({ length: bars }, () => 0);
    }

    const bins = new Array(bars).fill(0);
    const binSize = Math.max(1, Math.floor(data.length / bars));
    for (let i = 0; i < bars; i++) {
      const start = i * binSize;
      const end = Math.min(data.length, start + binSize);
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += data[j];
      }
      bins[i] = sum / Math.max(1, end - start);
    }
    return bins;
  };

  const bins = getBins().slice(2);
  const multiplier = 1 + sensitivity * 12;

  return (
    <div className="relative flex items-end justify-center gap-1 h-20">
      {bins.map((value, index) => {
        const normalized = Math.min(1, (value / 255) * multiplier);
        const shape = 0.7 + Math.sin(index * 0.9) * 0.2;
        const height = isActive
          ? Math.max(baseHeight, normalized * shape * maxHeight)
          : baseHeight;
        return (
          <div
            key={index}
            className={`w-1 rounded-full transition-all duration-100 ${getBarColor()}`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}
