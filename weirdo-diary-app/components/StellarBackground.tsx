import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Dimensions, Platform } from "react-native";

const { width, height } = Dimensions.get("window");

// Pre-defined static star positions with random sizes and twinkling behaviors
// This avoids dynamic state updates and allows pure native-driven animations
const STAR_DATA = [
  { top: "10%", left: "15%", size: 2, delay: 0, duration: 2000 },
  { top: "15%", left: "80%", size: 3, delay: 800, duration: 2500 },
  { top: "30%", left: "45%", size: 1.5, delay: 400, duration: 1800 },
  { top: "45%", left: "10%", size: 2.5, delay: 1200, duration: 3000 },
  { top: "50%", left: "85%", size: 2, delay: 200, duration: 2200 },
  { top: "65%", left: "30%", size: 3, delay: 1500, duration: 2700 },
  { top: "70%", left: "75%", size: 1.5, delay: 600, duration: 1600 },
  { top: "85%", left: "20%", size: 2, delay: 1000, duration: 2400 },
  { top: "90%", left: "60%", size: 2.5, delay: 500, duration: 2100 },
  { top: "25%", left: "70%", size: 2, delay: 1300, duration: 2600 },
  { top: "60%", left: "50%", size: 1.5, delay: 900, duration: 1900 },
  { top: "80%", left: "90%", size: 3, delay: 100, duration: 2800 },
];

interface StellarBackgroundProps {
  children?: React.ReactNode;
}

export function StellarBackground({ children }: StellarBackgroundProps) {
  // Create an animated value for each star
  const anims = useRef(STAR_DATA.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, index) => {
      const data = STAR_DATA[index];
      
      const twinkle = Animated.sequence([
        // Delay before start
        Animated.delay(data.delay),
        // Twinkle loop
        Animated.loop(
          Animated.sequence([
            // Fade in
            Animated.timing(anim, {
              toValue: Math.random() * 0.7 + 0.3, // random peak opacity between 0.3 and 1.0
              duration: data.duration * 0.4,
              useNativeDriver: true,
            }),
            // Hold peak shine
            Animated.delay(data.duration * 0.2),
            // Fade out
            Animated.timing(anim, {
              toValue: 0.05, // dim state
              duration: data.duration * 0.4,
              useNativeDriver: true,
            }),
            // Dark gap
            Animated.delay(data.duration * 0.3),
          ])
        ),
      ]);

      twinkle.start();
      return twinkle;
    });

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [anims]);

  return (
    <View style={styles.container}>
      {/* Background dark canvas */}
      <View style={styles.canvas} />

      {/* Layered Gradient Mesh Ambient Glow spots */}
      <View style={[styles.glowSpot, styles.purpleGlow]} />
      <View style={[styles.glowSpot, styles.blueGlow]} />
      <View style={[styles.glowSpot, styles.indigoGlow]} />

      {/* Twinkling Star Field */}
      {STAR_DATA.map((star, index) => (
        <Animated.View
          key={index}
          style={[
            styles.star,
            {
              top: star.top as any,
              left: star.left as any,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              opacity: anims[index],
              shadowColor: "#ffdfa9",
              shadowOpacity: 0.8,
              shadowRadius: star.size,
              elevation: 1,
            },
          ]}
        />
      ))}

      {/* Foreground Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: "#070a18",
  },
  canvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#070a18",
  },
  content: {
    flex: 1,
    backgroundColor: "transparent",
  },
  star: {
    position: "absolute",
    backgroundColor: "#ffdfa9", // golden-white star glow
  },
  glowSpot: {
    position: "absolute",
    borderRadius: 9999,
    opacity: Platform.OS === "ios" ? 0.35 : 0.25, // slightly dimmer on android for performance safety
  },
  // Ambient deep violet in upper left
  purpleGlow: {
    top: -height * 0.2,
    left: -width * 0.3,
    width: width * 1.2,
    height: width * 1.2,
    backgroundColor: "#1c143a",
  },
  // Ambient navy-indigo in bottom right
  blueGlow: {
    bottom: -height * 0.3,
    right: -width * 0.3,
    width: width * 1.4,
    height: width * 1.4,
    backgroundColor: "#06132b",
  },
  // Ambient subtle cosmic teal in center-right
  indigoGlow: {
    top: height * 0.3,
    right: -width * 0.4,
    width: width * 0.9,
    height: width * 0.9,
    backgroundColor: "#0f0b29",
  },
});
