// import { Stack } from "expo-router";

// export default function RootLayout() {
//   return <Stack />;
// }
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "../context/ThemeContext";

export default function Layout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Stack
          screenOptions={{
            headerShown: false,   // সব পেজে default header hide থাকবে
          }}
        />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
