interface AudioVisualizerProps {
  isActive: boolean;
  state: "idle" | "listening" | "speaking";
  data?: number[];
  sensitivity?: number; // New prop for microphone sensitivity (0-1)
}

export function AudioVisualizer({ isActive, state, data, sensitivity = 0.5 }: AudioVisualizerProps) {
  const bars = 20; // More bars like in templates

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

  const getBarHeight = (index: number) => {
    if (!isActive) {
      return "10px";
    }
    if (isActive && (!data || data.length === 0)) {
      return "60px";
    }

    // Calculate RMS volume for better response
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / data.length);

    const sensitivityMultiplier = 1 + (sensitivity * 14); // 1x to 15x
    const baseVolume = Math.min(1, rms * sensitivityMultiplier);

    // Better height calculation with more dynamic range
    const baseHeight = 8;
    const maxHeight = 70;
    const variationSeed = Math.sin(index * 1.7 + baseVolume * 10);
    const variation = 0.6 + Math.abs(variationSeed) * 0.7;
    const height = Math.max(baseHeight, baseVolume * variation * maxHeight + Math.random() * 6);
    return `${height}px`;
  };

  return (
    <div className="relative flex items-end justify-center gap-1 h-20">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-150 ${getBarColor()}`}
          style={{
            height: getBarHeight(i),
            animationDelay: `${i * 50}ms`,
          }}
        />
      ))}
    </div>
  );
}
