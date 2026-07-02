import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav from "../../components/BottomNav";
import { useTheme } from "../../context/ThemeContext";
import { auth, db } from "../../FirebaseConfig";

export default function GuardianHome() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [guardianName, setGuardianName] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const { isDark, colors, toggleTheme } = useTheme();

  const calculateStatus = useCallback((lat: number | null | undefined, lng: number | null | undefined, zone: any) => {
    if (!zone) return "Not Active";
    if (!lat || !lng) return "Inactive";

    const R = 6371e3; // Earth radius in meters
    const φ1 = lat * Math.PI / 180;
    const φ2 = zone.latitude * Math.PI / 180;
    const Δφ = (zone.latitude - lat) * Math.PI / 180;
    const Δλ = (zone.longitude - lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    return distance <= zone.radius ? "Safe" : "Unsafe";
  }, []);

  const updateStudentInState = useCallback((studentId: string, updates: any) => {
    setStudents(prev => prev.map(s => {
      if (s.student_uid === studentId) {
        const merged = { ...s, ...updates };
        return {
          ...merged,
          statusText: calculateStatus(merged.latitude, merged.longitude, merged.activeZone)
        };
      }
      return s;
    }));
  }, [calculateStatus]);

  // Real-time listener for students and their locations
  useEffect(() => {
    let unsubUser: (() => void) | null = null;
    let unsubRequests: (() => void) | null = null;
    let unsubStudents: { [key: string]: () => void } = {};
    let unsubZones: { [key: string]: () => void } = {};

    const setupListeners = async () => {
      const user = auth.currentUser;
      if (!user) {
        console.log("No auth user found");
        return;
      }

      console.log("Setting up listeners for guardian:", user.uid);

      unsubUser = onSnapshot(doc(db, "users", user.uid), (userSnap) => {
        if (!userSnap.exists()) return;

        const userData = userSnap.data();
        const mobile = userData.mobile;
        setGuardianName(userData.name?.split(" ")[0] || "Guardian");

        if (!mobile) {
          console.log("Guardian has no mobile number set");
          return;
        }

        const qAccepted = query(
          collection(db, "guardian_requests"),
          where("guardian_phone", "==", mobile),
          where("status", "==", "accepted")
        );

        if (unsubRequests) unsubRequests();
        unsubRequests = onSnapshot(qAccepted, (snapshot) => {
          const studentRequests = snapshot.docs
            .map((d): any => ({ id: d.id, ...d.data() }))
            .filter((req: any) => req.student_uid);

          console.log("Found accepted student requests:", studentRequests.length);

          studentRequests.forEach((req: any) => {
            const sid = req.student_uid;
            if (sid && !unsubStudents[sid]) {
              unsubStudents[sid] = onSnapshot(doc(db, "users", sid), (sDoc) => {
                if (sDoc.exists()) {
                  const sData = sDoc.data();
                  updateStudentInState(sid, {
                    latitude: sData?.latitude,
                    longitude: sData?.longitude,
                    student_name: sData?.name || "Student"
                  });
                }
              });

              const zoneQ = query(
                collection(db, "safe_zones"),
                where("userId", "==", sid),
                where("isActive", "==", true)
              );
              unsubZones[sid] = onSnapshot(zoneQ, (zSnap) => {
                const activeZone = !zSnap.empty ? zSnap.docs[0].data() : null;
                updateStudentInState(sid, { activeZone });
              });
            }
          });

          setStudents(prev => {
            return studentRequests.map((req: any) => {
              const sid = req.student_uid;
              const existing = prev.find(p => p.student_uid === sid);
              return {
                ...req,
                student_uid: sid,
                latitude: existing?.latitude,
                longitude: existing?.longitude,
                activeZone: existing?.activeZone,
                student_name: existing?.student_name || req.student_name,
                statusText: calculateStatus(existing?.latitude, existing?.longitude, existing?.activeZone)
              };
            });
          });
        });

        const qPending = query(
          collection(db, "guardian_requests"),
          where("guardian_phone", "==", mobile),
          where("status", "==", "pending")
        );
        onSnapshot(qPending, (s) => setPendingRequests(s.size));
      });
    };

    setupListeners();

    return () => {
      if (unsubRequests) unsubRequests();
      if (unsubUser) unsubUser();
      Object.values(unsubStudents).forEach(fn => fn());
      Object.values(unsubZones).forEach(fn => fn());
    };
  }, [calculateStatus, updateStudentInState]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Force a re-mount essentially or just re-fetch pending count
    const user = auth.currentUser;
    if (user) {
      getDoc(doc(db, "users", user.uid)).then(userSnap => {
        if (userSnap.exists()) {
          const mobile = userSnap.data().mobile;
          const qPending = query(
            collection(db, "guardian_requests"), 
            where("guardian_phone", "==", mobile),
            where("status", "==", "pending")
          );
          getDocs(qPending).then(s => {
            setPendingRequests(s.size);
            setRefreshing(false);
          });
        }
      });
    } else {
      setRefreshing(false);
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Hello, {guardianName}</Text>
          <Text style={[styles.pendingText, { color: colors.headerText, opacity: 0.9 }]}>{pendingRequests} pending request{pendingRequests === 1 ? "" : "s"}</Text>
        </View>
        <TouchableOpacity onPress={toggleTheme} style={styles.themeToggleBtn}>
          <MaterialIcons name={isDark ? "wb-sunny" : "nights-stay"} size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Connected Children</Text>
        </View>
        
        {students.length > 0 ? (
          students.map((student) => (
            <View key={student.id} style={[styles.studentCardFull, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.cardTopRow}>
                <View style={[styles.avatarLarge, { backgroundColor: colors.isDark ? colors.background : "#e8f5e9" }]}>
                  <MaterialIcons name="person" size={40} color={colors.primary} />
                </View>
                <View style={styles.studentInfoFull}>
                  <Text style={[styles.studentNameFull, { color: colors.text }]}>{student.student_name}</Text>
                </View>
                {student.statusText === "Not Active" ? (
                  <View style={[styles.statusBadge, styles.statusBadgeCompact, { backgroundColor: "#9E9E9E" }]}>
                    <Text style={[styles.statusBadgeText, styles.statusBadgeTextCompact]}>Not{"\n"}Active</Text>
                  </View>
                ) : (
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: student.statusText === "Safe" ? "#4CAF50" : "#FF5252" }
                  ]}>
                    <Text style={styles.statusBadgeText}>{student.statusText}</Text>
                    <MaterialIcons name="keyboard-arrow-down" size={16} color="#fff" />
                  </View>
                )}
              </View>
              
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={[styles.liveMapBtn, { backgroundColor: colors.isDark ? "#2E7D32" : "#A5D6A7", flex: 1 }]}
                  onPress={() => router.push({
                    pathname: "/guardian/LiveTracking",
                    params: { studentId: student.student_uid || student.id, studentName: student.student_name }
                  })}
                >
                  <Text style={[styles.liveMapBtnText, { color: colors.isDark ? "#fff" : "#333" }]}>View Live Map</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.emptyContainer, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <MaterialIcons name="people-outline" size={48} color={colors.subText} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>No students connected yet</Text>
          </View>
        )}
      </ScrollView>

      <BottomNav activeTab="Home" userType="Guardian" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#4CAF50", height: 100, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 30 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  notificationBtn: { position: "relative" },
  themeToggleBtn: { alignSelf: "center" },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#FF5252", position: "absolute", top: -5, right: -5, borderWidth: 1.5, borderColor: "#4CAF50", justifyContent: "center", alignItems: "center" },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  scrollContent: { padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  viewAllText: { color: '#4CAF50', fontSize: 14, fontWeight: '600' },
  studentCardFull: { 
    backgroundColor: "#fff", 
    borderRadius: 15, 
    padding: 15, 
    marginBottom: 20, 
    elevation: 4, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0'
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatarLarge: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center' },
  studentInfoFull: { flex: 1, marginLeft: 15, paddingTop: 2 },
  studentNameFull: { fontSize: 20, fontWeight: "bold", color: "#333" },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 5, 
    borderRadius: 8,
    minWidth: 76,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: 0
  },
  statusBadgeCompact: {
    flexDirection: 'column',
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 58,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  statusBadgeText: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginRight: 4 },
  statusBadgeTextCompact: { fontSize: 11, lineHeight: 12, marginRight: 0, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  liveMapBtn: { 
    backgroundColor: '#A5D6A7', 
    paddingVertical: 10, 
    borderRadius: 20, 
    alignItems: 'center',
    marginTop: 0,
    flex: 1,
  },
  liveMapBtnText: { color: '#333', fontWeight: 'bold', fontSize: 14 },
  chatBtn: {
    backgroundColor: '#8E24AA',
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 0,
    flex: 0.45,
  },
  chatBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 40, backgroundColor: "#f9f9f9", padding: 30, borderRadius: 15, borderStyle: "dashed", borderWidth: 1, borderColor: "#ccc" },
  emptyText: { marginTop: 10, color: "#999", fontSize: 15 },
  pendingText: { color: "#fff", fontSize: 14, marginTop: 6, opacity: 0.9 },
});
