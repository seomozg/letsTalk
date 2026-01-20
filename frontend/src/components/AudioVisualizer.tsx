interface AudioVisualizerProps {
  isActive: boolean;
  state: "idle" | "listening" | "speaking";
  data?: number[];
}

export function AudioVisualizer({ isActive, state, data }: AudioVisualizerProps) {
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

    // Calculate volume level
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += Math.abs(data[i] - 128);
    }
    const volume = sum / data.length / 128;

    // Amplify and add some randomness for animation
    const amplified = Math.min(1, volume * 5);
    const height = Math.max(10, amplified * 50 + Math.random() * 10);
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
