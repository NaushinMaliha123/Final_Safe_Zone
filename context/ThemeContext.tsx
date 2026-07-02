import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export interface ColorTheme {
  isDark: boolean;
  background: string;
  cardBg: string;
  cardBorder: string;
  text: string;
  textDark: string;
  subText: string;
  primary: string;
  headerBg: string;
  headerText: string;
  inputBg: string;
  inputBorder: string;
  bottomNavBg: string;
  bottomNavBorder: string;
  accent: string;
  greenAccent: string;
  greenText: string;
  placeholderText: string;
  statusBar: "dark-content" | "light-content";
}

export const themeColors = {
  light: {
    isDark: false,
    background: "#ffffff",
    cardBg: "#ffffff",
    cardBorder: "#f0f0f0",
    text: "#333333",
    textDark: "#000000",
    subText: "#666666",
    primary: "#4CAF50",
    headerBg: "#4CAF50",
    headerText: "#ffffff",
    inputBg: "#ffffff",
    inputBorder: "#ccc",
    bottomNavBg: "#ffffff",
    bottomNavBorder: "#eee",
    accent: "#FF5252",
    greenAccent: "#E8F5E9",
    greenText: "#2e7d32",
    placeholderText: "#666666",
    statusBar: "dark-content",
  } as ColorTheme,
  dark: {
    isDark: true,
    background: "#121212",
    cardBg: "#1e1e1e",
    cardBorder: "#2c2c2c",
    text: "#e0e0e0",
    textDark: "#ffffff",
    subText: "#a0a0a0",
    primary: "#4CAF50", // Keep green primary
    headerBg: "#1e1e1e", // Dark header background in dark mode
    headerText: "#ffffff",
    inputBg: "#1e1e1e",
    inputBorder: "#444444",
    bottomNavBg: "#1e1e1e",
    bottomNavBorder: "#2c2c2c",
    accent: "#ff8a80",
    greenAccent: "#1b5e20",
    greenText: "#81c784",
    placeholderText: "#888888",
    statusBar: "light-content",
  } as ColorTheme,
};

type ThemeContextType = {
  isDark: boolean;
  colors: ColorTheme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  colors: themeColors.light,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem("theme_mode");
        if (savedTheme === "dark") {
          setIsDark(true);
        }
      } catch (e) {
        console.error("Failed to load theme preference", e);
      } finally {
        setLoading(false);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    try {
      const nextIsDark = !isDark;
      setIsDark(nextIsDark);
      await AsyncStorage.setItem("theme_mode", nextIsDark ? "dark" : "light");
    } catch (e) {
      console.error("Failed to save theme preference", e);
    }
  };

  const colors = isDark ? themeColors.dark : themeColors.light;

  if (loading) {
    return null; // Or a loading screen, but null is fine to prevent flash
  }

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
