import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav from "../../components/BottomNav";
import { auth, db } from "../../FirebaseConfig";
import { useTheme } from "../../context/ThemeContext";

export default function StudentAlerts() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const { colors } = useTheme();

  const fetchAlerts = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // 1. Try to load cached alerts instantly
      const cachedAlerts = await AsyncStorage.getItem(`cached_student_alerts_${user.uid}`);
      if (cachedAlerts) {
        setAlerts(JSON.parse(cachedAlerts));
      }
    } catch (e) {
      console.error("Error reading cached alerts:", e);
    }

    try {
      // Fetch alerts first, then sort locally to avoid composite index requirement
      const q = query(
        collection(db, "alerts"), 
        where("student_uid", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Manual sort by timestamp (descending)
      list.sort((a: any, b: any) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });

      const slicedList = list.slice(0, 2);
      setAlerts(slicedList);

      // Save fresh alerts to cache
      await AsyncStorage.setItem(`cached_student_alerts_${user.uid}`, JSON.stringify(slicedList));
    } catch (err) {
      console.error("Fetch alerts error:", err);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const progress = useRef(new Animated.Value(0)).current;
  const sosTriggered = useRef(false);
  const [sosStatus, setSosStatus] = useState<string>("Hold to trigger SOS");
  const [isHolding, setIsHolding] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchAlerts().then(() => setRefreshing(false));
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

  const sendSosAlert = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Unable to send SOS", "No user is signed in.");
      return;
    }

    try {
      const contactsQuery = query(
        collection(db, "emergency_contacts"),
        where("userId", "==", user.uid)
      );
      const contactSnapshot = await getDocs(contactsQuery);
      if (contactSnapshot.empty) {
        Alert.alert("No emergency contact found", "Please add an emergency contact first.");
        setSosStatus("SOS not sent — no contact found");
        return;
      }

      const contacts = contactSnapshot.docs.map(doc => doc.data());
      const randomIndex = Math.floor(Math.random() * contacts.length);
      const randomContact = contacts[randomIndex];
      const rawPhone = randomContact?.phone || "";
      const targetPhone = rawPhone.replace(/[^0-9+]/g, "").trim();

      const saveAlertPromise = (async () => {
        await addDoc(collection(db, "alerts"), {
          student_uid: user.uid,
          student_name: user.displayName || user.email?.split("@")[0] || "Student",
          title: "Emergency Alert",
          description: "Emergency SOS triggered by the student.",
          timestamp: serverTimestamp(),
          type: "emergency",
          audience: "student",
        });

        const guardianSnapshot = await getDocs(
          query(
            collection(db, "guardian_requests"),
            where("student_uid", "==", user.uid),
            where("status", "==", "accepted")
          )
        );

        if (!guardianSnapshot.empty) {
          for (const gd of guardianSnapshot.docs) {
            const data = gd.data();
            if (data.guardian_phone) {
              // Target guardian can get an SMS too or notification
            }
          }
        }
      })();

      let callPromise = Promise.resolve();
      if (targetPhone) {
        let phoneUrl = `tel:${targetPhone}`;
        if (Platform.OS === "android") {
          phoneUrl = `tel:${targetPhone}`;
        }
        callPromise = Linking.canOpenURL(phoneUrl).then((supported) => {
          if (supported) {
            return Linking.openURL(phoneUrl).then(() => {});
          } else {
            console.log("Phone call not supported on this device.");
          }
        });
      }

      await Promise.all([saveAlertPromise, callPromise]);
      setSosStatus("SOS alert sent & call initiated");
      fetchAlerts();
    } catch (err) {
      console.error("SOS error:", err);
      setSosStatus("SOS failed to trigger");
    }
  };

  const onSosPressIn = () => {
    setIsHolding(true);
    setSosStatus("Keep holding for 3 seconds...");
    sosTriggered.current = false;
    progress.setValue(0);

    Animated.timing(progress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !sosTriggered.current) {
        sosTriggered.current = true;
        setIsHolding(false);
        sendSosAlert();
      }
    });
  };

  const onSosPressOut = () => {
    if (!sosTriggered.current) {
      setIsHolding(false);
      progress.stopAnimation();
      progress.setValue(0);
      setSosStatus("SOS cancelled by user");

      try {
        const user = auth.currentUser;
        if (user) {
          addDoc(collection(db, "alerts"), {
            student_uid: user.uid,
            student_name: user.displayName || user.email?.split("@")[0] || "Student",
            title: "Alert Cancelled",
            description: "Emergency alert cancelled by the student.",
            timestamp: serverTimestamp(),
            type: "cancel",
            audience: "student",
          }).then(() => {
            fetchAlerts();
          });
        }
      } catch (err) {
        console.error("Failed to record SOS cancel alert:", err);
      }

      Alert.alert("SOS cancelled", "Press and hold for 3 seconds to trigger SOS.");
    }
  };

  const onSosLongPress = () => {
    // Handled in onSosPressIn timing completion
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Safety Alerts</Text>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <View key={alert.id} style={[styles.alertCard, { backgroundColor: colors.cardBg, borderLeftColor: alert.type === "emergency" ? colors.accent : colors.primary }]}>
              <View style={styles.alertHeader}>
                <Text style={[styles.alertTitle, { color: colors.textDark }]}>{alert.title}</Text>
                <Text style={[styles.alertTime, { color: colors.subText }]}>{formatTime(alert.timestamp)}</Text>
              </View>
              <Text style={[styles.alertDesc, { color: colors.text }]}>{alert.description || alert.desc}</Text>
            </View>
          ))
        ) : (
          <Text style={[styles.emptyText, { color: colors.subText }]}>No recent alerts.</Text>
        )}

        <View style={styles.sosWrapper}>
          <Animated.View
            style={[
              styles.sosRing,
              {
                transform: [
                  {
                    rotate: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  },
                ],
                opacity: progress.interpolate({
                  inputRange: [0, 0.25, 0.75, 1],
                  outputRange: [0.3, 0.7, 0.7, 0.3],
                }),
              },
            ]}
          />
          <TouchableOpacity 
            style={[styles.sosButton, isHolding && styles.sosButtonHold]}
            onPressIn={onSosPressIn}
            onLongPress={onSosLongPress}
            onPressOut={onSosPressOut}
            delayLongPress={3000}
            activeOpacity={0.8}
          >
            <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.sosStatus, { color: colors.text }]}>{sosStatus}</Text>
      </ScrollView>

      <BottomNav activeTab="Alerts" userType="Student" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#4CAF50", height: 80, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  scrollContent: { padding: 20 },
  alertCard: { backgroundColor: "#fff", borderRadius: 10, padding: 15, marginBottom: 15, elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderLeftWidth: 5, borderLeftColor: "#4CAF50" },
  alertHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  alertTitle: { fontSize: 16, fontWeight: "bold" },
  alertTime: { fontSize: 12, color: "#888" },
  alertDesc: { fontSize: 14, color: "#666" },
  emptyText: { textAlign: "center", marginTop: 50, color: "#999" },
  sosWrapper: { alignSelf: "center", marginTop: 40, width: 130, height: 130, alignItems: "center", justifyContent: "center" },
  sosRing: { position: "absolute", width: 130, height: 130, borderRadius: 65, borderWidth: 8, borderColor: "rgba(255, 82, 82, 0.4)", borderTopColor: "rgba(255, 82, 82, 1)", borderRightColor: "rgba(255, 82, 82, 0.2)", borderBottomColor: "rgba(255, 82, 82, 0.1)", borderLeftColor: "rgba(255, 82, 82, 0.2)" },
  sosButton: { backgroundColor: "#FF5252", height: 100, width: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  sosButtonHold: { backgroundColor: "#D32F2F" },
  sosText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  sosStatus: { marginTop: 12, textAlign: "center", color: "#555", fontSize: 14 },
});
