import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { auth } from "../FirebaseConfig";

const { width } = Dimensions.get("window");

// Responsive font scale
const scaleFont = (size: number) => (width / 375) * size;

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    // onAuthStateChanged waits for Firebase to restore the persisted session.
    // auth.currentUser is null on first render even if the user is logged in,
    // so using it directly (or with setTimeout) always fails.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) {
        // Already logged in → skip login and go directly to home
        router.replace("./DashboardPage");
      } else {
        // Not logged in → show splash / onboarding
        router.replace("./splash");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.isDark ? colors.background : "#4CAF50" }]}>
      <Text style={[styles.title, { color: colors.isDark ? colors.textDark : "#fff" }]}>Welcome to our safety app</Text>
      <Text style={[styles.subtitle, { color: colors.isDark ? colors.subText : "#e8f5e9" }]}>
        Keeping you safe, whenever you go.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#4CAF50", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  title: { fontSize: scaleFont(26), fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 5 },
  subtitle: { fontSize: scaleFont(16), color: "#e8f5e9", textAlign: "center", marginTop: 8, opacity: 0.9 },
});
