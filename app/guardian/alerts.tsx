import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav from "../../components/BottomNav";
import { auth, db } from "../../FirebaseConfig";
import { useTheme } from "../../context/ThemeContext";

export default function GuardianAlerts() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const { colors } = useTheme();

  const fetchGuardianData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // 1. Try to load cached requests instantly
      const cachedReqs = await AsyncStorage.getItem(`cached_guardian_requests_${user.uid}`);
      if (cachedReqs) {
        setRequests(JSON.parse(cachedReqs));
      }
    } catch (e) {
      console.error("Error reading cached requests:", e);
    }

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const mobile = userSnap.data().mobile;
        if (mobile) {
          // 1. Fetch Pending Requests
          const qReqs = query(
            collection(db, "guardian_requests"), 
            where("guardian_phone", "==", mobile),
            where("status", "==", "pending")
          );
          const reqSnap = await getDocs(qReqs);
          const freshRequests = reqSnap.docs.map(d => ({ id: d.id, ...d.data(), type: 'request' }));
          setRequests(freshRequests);

          // Save fresh requests to cache
          await AsyncStorage.setItem(`cached_guardian_requests_${user.uid}`, JSON.stringify(freshRequests));
        }
      }
    } catch (err) {
      console.error("Fetch guardian alerts error:", err);
    }
  };

  const handleRequestAction = async (requestId: string, studentName: string, action: 'accepted' | 'rejected') => {
    try {
      if (action === 'rejected') {
        await deleteDoc(doc(db, "guardian_requests", requestId));
        Alert.alert("Cancellation", `You have cancelled the request from ${studentName}.`);
      } else {
        await updateDoc(doc(db, "guardian_requests", requestId), { status: 'accepted' });
        Alert.alert("Connection Successful", `You and ${studentName} are now connected.`);
      }
      fetchGuardianData();
    } catch (err) {
      Alert.alert("Error", "Action failed. Please try again.");
    }
  };

  useEffect(() => {
    fetchGuardianData();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchGuardianData().then(() => setRefreshing(false));
  }, []);

  const parseDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000);
    }
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "Just now";
    const date = parseDate(timestamp);
    const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr}, ${timeStr}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Notifications & Alerts</Text>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Pending Requests Section (Interactive) */}
        {requests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textDark }]}>New Connection Requests</Text>
            {requests.map((req) => (
              <View key={req.id} style={[styles.requestCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <View style={styles.requestInfo}>
                  <Text style={[styles.studentName, { color: colors.primary }]}>{req.student_name}</Text>
                  <Text style={[styles.requestText, { color: colors.text }]}>wants to connect with you</Text>
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.acceptBtn, { backgroundColor: colors.primary }]} 
                    onPress={() => handleRequestAction(req.id, req.student_name, 'accepted')}
                  >
                    <Text style={styles.actionBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.rejectBtn, { backgroundColor: colors.accent }]} 
                    onPress={() => handleRequestAction(req.id, req.student_name, 'rejected')}
                  >
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {requests.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.subText }]}>No notifications</Text>
          </View>
        )}

      </ScrollView>

      <BottomNav activeTab="Alerts" userType="Guardian" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#4CAF50", height: 80, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  scrollContent: { padding: 20 },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 15 },
  requestCard: { backgroundColor: "#f0f7ff", borderRadius: 12, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: "#cce5ff" },
  requestInfo: { marginBottom: 12 },
  studentName: { fontSize: 17, fontWeight: "bold", color: "#004085" },
  requestText: { fontSize: 14, color: "#666", marginTop: 2 },
  actionRow: { flexDirection: "row", justifyContent: "flex-end" },
  actionBtn: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 6, marginLeft: 10 },
  acceptBtn: { backgroundColor: "#4CAF50" },
  rejectBtn: { backgroundColor: "#FF5252" },
  actionBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  alertCard: { backgroundColor: "#fff", borderRadius: 10, padding: 15, marginBottom: 15, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderLeftWidth: 5, borderLeftColor: "#4CAF50" },
  alertHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  alertTitle: { fontSize: 16, fontWeight: "bold" },
  emergencyText: { color: "#FF5252" },
  alertTime: { fontSize: 12, color: "#888" },
  alertMeta: { fontSize: 12, color: "#4CAF50", marginBottom: 4, fontWeight: "600" },
  alertDesc: { fontSize: 14, color: "#666" },
  emptyContainer: { paddingVertical: 40, alignItems: "center", justifyContent: "center" },
  emptyText: { textAlign: "center", marginTop: 20, color: "#999" },
});
