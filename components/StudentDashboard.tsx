import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface StudentDashboardProps {
  studentMenuItems: any[];
}

export default function StudentDashboard({ studentMenuItems }: StudentDashboardProps) {
  const router = useRouter();

  return (
    <>
      {studentMenuItems.map((item, index) => (
        <TouchableOpacity 
          key={index} 
          style={styles.card}
          onPress={() => router.push(item.route as any)}
        >
          <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
            <MaterialIcons name={item.icon as any} size={28} color="#fff" />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 15, marginBottom: 15, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  iconContainer: { width: 40, height: 40, borderRadius: 8, marginRight: 15, justifyContent: "center", alignItems: "center" },
  cardTextContainer: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  cardSubtitle: { fontSize: 12, color: "#999", marginTop: 2 },
});
