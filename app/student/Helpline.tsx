import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Linking, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav from "../../components/BottomNav";
import { useTheme } from "../../context/ThemeContext";

export default function Helpline() {
  const router = useRouter();
  const { colors } = useTheme();

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const emergencyNumbers = [
    { name: "National Emergency", number: "999" },
    { name: "Fire Service", number: "02-9555555" },
    { name: "Police HQ", number: "100" },
    { name: "Ambulance", number: "01713-033333" },
    { name: "Women/Child Abuse", number: "109" },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Emergency Helpline</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}>
        <Text style={[styles.sectionTitle, { color: colors.textDark }]}>Tap to Call</Text>
        {emergencyNumbers.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={[styles.callCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]} 
            onPress={() => handleCall(item.number)}
          >
            <View style={[styles.iconCircle, { backgroundColor: colors.isDark ? colors.background : "#e8f5e9" }]}>
              <MaterialIcons name="phone-in-talk" size={26} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.name, { color: colors.textDark }]}>{item.name}</Text>
              <Text style={[styles.number, { color: colors.subText }]}>{item.number}</Text>
            </View>
            <MaterialIcons name="call" size={24} color={colors.primary} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <BottomNav activeTab="Helpline" userType="Student" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#4CAF50", height: 80, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 20, color: "#333" },
  callCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#f9f9f9", padding: 15, borderRadius: 12, marginBottom: 15, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, borderWidth: 1, borderColor: "transparent" },
  iconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#e8f5e9", justifyContent: "center", alignItems: "center", marginRight: 15 },
  textContainer: { flex: 1 },
  name: { fontSize: 16, fontWeight: "bold", color: "#333" },
  number: { fontSize: 14, color: "#666", marginTop: 2 },
});
