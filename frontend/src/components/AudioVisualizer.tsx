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

    // Calculate volume level with improved sensitivity
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i] - 128);
    }
    const rawVolume = sum / data.length / 128;

    // Apply sensitivity multiplier (higher sensitivity = more responsive)
    // sensitivity ranges from 0-1, where 1 is most sensitive
    const sensitivityMultiplier = 1 + (sensitivity * 9); // 1x to 10x amplification for much higher sensitivity
    const volume = Math.min(1, rawVolume * sensitivityMultiplier);

    // Better height calculation with more dynamic range
    const baseHeight = 10;
    const maxHeight = 60;
    const height = Math.max(baseHeight, volume * maxHeight + Math.random() * 5);
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
