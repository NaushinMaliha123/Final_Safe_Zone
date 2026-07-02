import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface GuardianDashboardProps {
  guardianMenuItems: any[];
}

export default function GuardianDashboard({ guardianMenuItems }: GuardianDashboardProps) {
  const router = useRouter();

  return (
    <>
      {guardianMenuItems.map((item, index) => (
        <TouchableOpacity 
          key={index} 
          style={[styles.card, styles.guardianCard]}
          onPress={() => router.push(item.route as any)}
        >
          <View style={styles.avatarCircle}>
            <MaterialIcons name="person" size={30} color="#4CAF50" />
          </View>
          <View style={styles.cardTextContainer}>
            <Text style={styles.studentNameText}>{item.studentName}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            <View style={styles.actionBtnRow}>
              <TouchableOpacity style={[styles.miniBtn, styles.acceptBtn]} onPress={() => router.push("./GuardianRequests")}>
                <Text style={styles.miniBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.miniBtn, styles.rejectBtn]} onPress={() => router.push("./GuardianRequests")}>
                <Text style={styles.miniBtnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#ccc" />
        </TouchableOpacity>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 15, marginBottom: 15, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  guardianCard: { paddingVertical: 15 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  studentNameText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  cardSubtitle: { fontSize: 12, color: "#999", marginTop: 2 },
  cardTextContainer: { flex: 1 },
  actionBtnRow: { flexDirection: 'row', marginTop: 10 },
  miniBtn: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 5, marginRight: 10 },
  acceptBtn: { backgroundColor: '#4CAF50' },
  rejectBtn: { backgroundColor: '#FF5252' },
  miniBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
