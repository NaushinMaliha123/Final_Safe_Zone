import { MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav from "../../components/BottomNav";
import { auth, db } from "../../FirebaseConfig";
import { useTheme } from "../../context/ThemeContext";

export default function StudentHome() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [zoneCount, setZoneCount] = useState(0);
  const [contactCount, setContactCount] = useState(0);
  const [guardianCount, setGuardianCount] = useState(0);
  const { isDark, colors, toggleTheme } = useTheme();

  useEffect(() => {
    fetchStudentData();
    startLocationTracking();
  }, []);

  const startLocationTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Permission to access location was denied');
      return;
    }

    // High accuracy tracking that updates Firestore
    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000, // Update every 10 seconds
        distanceInterval: 10, // Or every 10 meters
      },
      async (location) => {
        const user = auth.currentUser;
        if (user) {
          try {
            await updateDoc(doc(db, "users", user.uid), {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              lastLocationUpdate: new Date(),
            });
          } catch (e) {
            console.error("Error updating location:", e);
          }
        }
      }
    );
  };

  const fetchStudentData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setFirstName(user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "User");

    try {
      // Fetch Safe Zones Count
      const zonesQ = query(collection(db, "safe_zones"), where("userId", "==", user.uid));
      const zonesSnap = await getDocs(zonesQ);
      setZoneCount(zonesSnap.size);

      // Fetch Emergency Contacts Count
      const contactsQ = query(collection(db, "emergency_contacts"), where("userId", "==", user.uid));
      const contactsSnap = await getDocs(contactsQ);
      setContactCount(contactsSnap.size);

      // Fetch Guardians Count (Accepted ones)
      const guardiansQ = query(
        collection(db, "guardian_requests"), 
        where("student_uid", "==", user.uid),
        where("status", "==", "accepted")
      );
      const guardiansSnap = await getDocs(guardiansQ);
      setGuardianCount(guardiansSnap.size);
    } catch (err) {
      console.error("Student home fetch error:", err);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchStudentData().then(() => setRefreshing(false));
  }, []);

  const studentMenuItems = [
    {
      title: "Set Safety Zone",
      subtitle: `${zoneCount} zone${zoneCount !== 1 ? 's' : ''} configured`,
      icon: "location-on",
      color: "#4CAF50",
      route: "/student/SafeZone",
    },
    {
      title: "Emergency Contacts",
      subtitle: `${contactCount} contact${contactCount !== 1 ? 's' : ''} saved`,
      icon: "contacts",
      color: "#FF5252",
      route: "/student/EmergencyContact",
    },
    {
      title: "My Guardian",
      subtitle: `${guardianCount} guardian${guardianCount !== 1 ? 's' : ''} active`,
      icon: "person-add",
      color: "#2196F3",
      route: "/student/MyGuardian",
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Hello, {firstName}</Text>
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
        {studentMenuItems.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
              <MaterialIcons name={item.icon as any} size={28} color="#fff" />
            </View>
            <View style={styles.cardTextContainer}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.cardSubtitle, { color: colors.subText }]}>{item.subtitle}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.subText} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <BottomNav activeTab="Home" userType="Student" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#4CAF50", height: 100, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingTop: 30 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "500" },
  notificationBtn: { position: "absolute", right: 20, top: 45 },
  themeToggleBtn: { position: "absolute", right: 20, top: 45 },
  scrollContent: { padding: 20, paddingTop: 10 },
  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 15, marginBottom: 15, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: "transparent" },
  iconContainer: { width: 40, height: 40, borderRadius: 8, marginRight: 15, justifyContent: "center", alignItems: "center" },
  cardTextContainer: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  cardSubtitle: { fontSize: 12, color: "#999", marginTop: 2 },
});
