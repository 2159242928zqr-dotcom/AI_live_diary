import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

interface VoiceWaveProps {
  active?: boolean;
  color?: string;
  count?: number;
}

export function VoiceWave({ active = false, color = "#c6604a", count = 6 }: VoiceWaveProps) {
  const anims = useRef(Array.from({ length: count }, () => new Animated.Value(1))).current;

  useEffect(() => {
    let animations: Animated.CompositeAnimation[] = [];
    
    if (active) {
      animations = anims.map((anim, i) => {
        // Create an organic, offset bouncing animation for each bar
        const bounce = Animated.sequence([
          Animated.timing(anim, {
            toValue: Math.random() * 3 + 1.5,
            duration: 250 + i * 50,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 0.6,
            duration: 250 + i * 50,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          })
        ]);
        return Animated.loop(bounce);
      });
      
      Animated.parallel(animations).start();
    } else {
      anims.forEach((anim) => {
        Animated.spring(anim, {
          toValue: 1,
          friction: 4,
          useNativeDriver: false,
        }).start();
      });
    }

    return () => {
      animations.forEach((anim) => anim.stop());
    };
  }, [active, anims, count]);

  return (
    <View style={styles.container}>
      {anims.map((anim, index) => {
        const height = anim.interpolate({
          inputRange: [0.5, 5],
          outputRange: [6, 40],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                backgroundColor: color,
                height: height,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    gap: 4,
    paddingHorizontal: 8,
  },
  bar: {
    width: 3.5,
    borderRadius: 2,
    minHeight: 6,
  },
});
