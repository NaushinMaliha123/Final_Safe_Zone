import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav from "../../components/BottomNav";
import { useTheme } from "../../context/ThemeContext";
import { auth, db } from "../../FirebaseConfig";

export default function MyGuardianScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [guardians, setGuardians] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchGuardianData();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  useEffect(() => {
    fetchGuardianData();
  }, []);

  const fetchGuardianData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      // 1. Fetch Accepted Guardians
      const qAccepted = query(
        collection(db, "guardian_requests"), 
        where("student_uid", "==", user.uid),
        where("status", "==", "accepted")
      );
      const snapAccepted = await getDocs(qAccepted);
      setGuardians(snapAccepted.docs.map(d => ({ id: d.id, ...d.data() })));

      // 2. Fetch Pending Requests
      const qPending = query(
        collection(db, "guardian_requests"), 
        where("student_uid", "==", user.uid),
        where("status", "==", "pending")
      );
      const snapPending = await getDocs(qPending);
      setPendingRequests(snapPending.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("Fetch guardian data error:", e);
    }
  };

  const handleRemoveGuardian = async (requestId: string, guardianName: string) => {
    Alert.alert(
      "Remove Guardian",
      `Are you sure you want to remove ${guardianName}? This will delete the connection.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "guardian_requests", requestId));
              Alert.alert("Removed", "Guardian removed successfully.");
              fetchGuardianData();
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "Failed to remove guardian.");
            }
          }
        }
      ]
    );
  };

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>My Guardians</Text>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Search Section */}
        <View style={styles.section}>
          <Pressable 
            style={[styles.searchCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]} 
            onPress={() => router.push("/student/SearchPeople")}
          >
            <View style={[styles.searchIconContainer, { backgroundColor: colors.isDark ? colors.background : "#E8F5E9" }]}>
              <MaterialIcons name="person-add" size={28} color={colors.primary} />
            </View>
            <View style={styles.searchTextContainer}>
              <Text style={[styles.searchTitle, { color: colors.textDark }]}>Add New Guardian</Text>
              <Text style={[styles.searchSub, { color: colors.subText }]}>Search by phone number</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.subText} />
          </Pressable>
        </View>

        {/* Accepted Guardians Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: colors.textDark }]}>Active Guardians ({guardians.length})</Text>
          {guardians.length > 0 ? (
            guardians.map((guardian) => (
              <View key={guardian.id} style={[styles.guardianItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <View style={[styles.avatar, { backgroundColor: colors.isDark ? colors.background : "#E8F5E9" }]}>
                  <MaterialIcons name="person" size={24} color={colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.textDark }]}>{guardian.guardian_name}</Text>
                  <Text style={[styles.relation, { color: colors.subText }]}>{guardian.relationship}</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => router.push({
                    pathname: "/chat" as any,
                    params: { friendId: guardian.target_uid, friendName: guardian.guardian_name }
                  })}
                  style={styles.chatButton}
                >
                  <Text style={styles.chatButtonText}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => handleRemoveGuardian(guardian.id, guardian.guardian_name)}
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <MaterialIcons name="people-outline" size={40} color={colors.subText} />
              <Text style={[styles.emptyText, { color: colors.subText }]}>No active guardians yet.</Text>
            </View>
          )}
        </View>

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: "#F57C00" }]}>Sent Requests (Pending)</Text>
            {pendingRequests.map((req) => (
              <View key={req.id} style={[styles.guardianItem, styles.pendingItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                <View style={[styles.avatar, { backgroundColor: colors.isDark ? colors.background : "#FFF3E0" }]}>
                  <MaterialIcons name="hourglass-empty" size={20} color="#F57C00" />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.name, { color: colors.textDark }]}>{req.guardian_name}</Text>
                  <Text style={[styles.relation, { color: colors.subText }]}>{req.relationship}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.statusButton,
                    { backgroundColor: colors.isDark ? colors.background : "#E8F5E9" },
                    pressed && styles.pressedAction,
                  ]}
                  onPress={() => router.push("/student/SearchPeople")}
                >
                  <Text style={[styles.statusText, { color: colors.primary }]}>Add Friend</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <BottomNav activeTab="Home" userType="Student" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { backgroundColor: "#4CAF50", height: 80, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, elevation: 4 },
  backButton: { marginRight: 16, padding: 4 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  container: { padding: 16, paddingBottom: 100 },
  section: { marginBottom: 24 },
  sectionHeader: { fontSize: 16, fontWeight: "bold", color: "#333", marginBottom: 12, marginLeft: 4 },
  searchCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, borderWidth: 1, borderColor: "transparent" },
  searchIconContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginRight: 16 },
  searchTextContainer: { flex: 1 },
  searchTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  searchSub: { fontSize: 13, color: "#777", marginTop: 2 },
  guardianItem: { backgroundColor: "#fff", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 10, borderWidth: 1, borderColor: "#eee" },
  pendingItem: { borderColor: "#FFE0B2", backgroundColor: "#FFFBFA" },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E8F5E9", justifyContent: "center", alignItems: "center", marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "bold", color: "#333" },
  relation: { fontSize: 13, color: "#666", marginTop: 2 },
  removeButton: { backgroundColor: '#FFF5F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FFE3E3' },
  removeButtonText: { color: '#FF5252', fontSize: 12, fontWeight: '600' },
  chatButton: { backgroundColor: '#F3E5F5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E1BEE7', marginRight: 8 },
  chatButtonText: { color: '#8E24AA', fontSize: 12, fontWeight: '600' },
  statusButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  pressedAction: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  statusText: { fontSize: 11, fontWeight: "bold", color: "#4CAF50" },
  emptyCard: { backgroundColor: "#fff", borderRadius: 12, padding: 30, alignItems: "center", justifyContent: "center", borderStyle: "dashed", borderWidth: 1, borderColor: "#ccc" },
  emptyText: { color: "#999", marginTop: 10, fontSize: 14 },
});
