import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { db } from "../../FirebaseConfig";
import { useTheme } from "../../context/ThemeContext";

export default function LiveTracking() {
  const router = useRouter();
  const { studentId, studentName } = useLocalSearchParams();
  const { colors } = useTheme();
  const [activeZone, setActiveZone] = useState<any>(null);
  const [studentLocation, setStudentLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isInside, setIsInside] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    // 1. Fetch and listen to Student's Current Location
    const unsubLocation = onSnapshot(doc(db, "users", studentId as string), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.latitude && data.longitude) {
          setStudentLocation({
            latitude: data.latitude,
            longitude: data.longitude
          });
        }
      }
    });

    // 2. Fetch Active Safe Zone
    fetchActiveZone();

    return () => unsubLocation();
  }, [studentId]);

  // Handle safety check whenever location or zone changes
  useEffect(() => {
    if (studentLocation && activeZone) {
      const distance = getDistance(
        studentLocation.latitude, 
        studentLocation.longitude, 
        activeZone.latitude, 
        activeZone.longitude
      );
      setIsInside(distance <= activeZone.radius);
    }
  }, [studentLocation, activeZone]);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchActiveZone = async () => {
    if (!studentId) return;
    try {
      const q = query(
        collection(db, "safe_zones"),
        where("userId", "==", studentId as string),
        where("isActive", "==", true)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const zone = querySnapshot.docs[0].data();
        // Check if duration expired
        if (zone.activeUntil) {
          const expiration = zone.activeUntil.toDate();
          if (expiration < new Date()) {
            // Duration expired (should be handled by a cloud function ideally, but checking here too)
            setActiveZone(null);
          } else {
            setActiveZone({ id: querySnapshot.docs[0].id, ...zone });
          }
        } else {
          setActiveZone({ id: querySnapshot.docs[0].id, ...zone });
        }
      } else {
        setActiveZone(null);
      }
    } catch (err) {
      console.error("Fetch active zone error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!activeZone) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Tracking: {studentName}</Text>
        </View>
        <View style={[styles.center, { backgroundColor: colors.background }]}>
          <MaterialIcons name="location-off" size={60} color={colors.subText} />
          <Text style={[styles.noActiveText, { color: colors.subText }]}>User does not set any active live map.</Text>
          <TouchableOpacity style={[styles.goBackBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={styles.goBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const region = {
    latitude: studentLocation?.latitude || activeZone.latitude,
    longitude: studentLocation?.longitude || activeZone.longitude,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Tracking: {studentName}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <MapView 
          style={styles.map} 
          initialRegion={region}
          key={studentId as string} // Force re-render if switching users
        >
          {/* 1. The Safe Zone Circle */}
          <Circle
            center={{ latitude: activeZone.latitude, longitude: activeZone.longitude }}
            radius={activeZone.radius}
            strokeColor={isInside ? "rgba(76, 175, 80, 0.8)" : "rgba(255, 82, 82, 0.8)"}
            fillColor={isInside ? "rgba(76, 175, 80, 0.15)" : "rgba(255, 82, 82, 0.15)"}
            strokeWidth={2}
          />

          {/* 2. Safe Zone Center Marker */}
          <Marker 
            coordinate={{ latitude: activeZone.latitude, longitude: activeZone.longitude }}
            title="Safe Zone Center"
          >
            <MaterialIcons name="stars" size={24} color={colors.primary} />
          </Marker>

          {/* 3. Student's Real-time Location Marker */}
          {studentLocation && (
            <Marker 
              coordinate={studentLocation}
              title={studentName as string}
              description={isInside ? "Inside Safe Zone" : "OUTSIDE SAFE ZONE!"}
            >
              <View style={styles.markerContainer}>
                <View style={[styles.markerBadge, { backgroundColor: isInside ? "#4CAF50" : "#FF5252" }]}>
                  <MaterialIcons name="person" size={22} color="#fff" />
                </View>
                <View style={[styles.markerArrow, { borderTopColor: isInside ? "#4CAF50" : "#FF5252" }]} />
              </View>
            </Marker>
          )}
        </MapView>

        <View style={[styles.zoneInfoPanel, { backgroundColor: colors.cardBg, shadowColor: colors.isDark ? '#000' : '#000', borderLeftWidth: 5, borderLeftColor: isInside ? "#4CAF50" : "#FF5252" }]}>
          <View style={styles.panelHeader}>
            <Text style={[styles.activeZoneTitle, { color: colors.textDark }]}>{activeZone.name}</Text>
            <View style={[styles.statusTag, { backgroundColor: isInside ? "#E8F5E9" : "#FFEBEE" }]}>
              <Text style={[styles.statusTagText, { color: isInside ? "#4CAF50" : "#FF5252" }]}>
                {isInside ? "Safe" : "UNSAFE"}
              </Text>
            </View>
          </View>
          
          <Text style={[styles.activeZoneDetail, { color: colors.subText }]}>Radius: {activeZone.radius}m</Text>
          {activeZone.activeUntil && (
            <Text style={[styles.activeZoneDetail, { color: colors.subText }]}>
              Expires: {activeZone.activeUntil.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}

          <View style={[styles.liveIndicator, { borderTopColor: colors.cardBorder }]}>
            <View style={[styles.dot, { backgroundColor: isInside ? "#4CAF50" : "#FF5252" }]} />
            <Text style={[styles.liveText, { color: isInside ? "#4CAF50" : "#FF5252" }]}>
              {isInside ? "Student is within protected area" : "Student has left the safe zone!"}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#4CAF50", height: 80, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20 },
  backBtn: { marginRight: 15 },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  map: { flex: 1 },
  noActiveText: { fontSize: 16, color: '#666', marginTop: 15, textAlign: 'center' },
  goBackBtn: { marginTop: 25, backgroundColor: '#4CAF50', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  goBackBtnText: { color: '#fff', fontWeight: 'bold' },
  markerContainer: { alignItems: 'center', justifyContent: 'center' },
  markerBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  markerArrow: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#4CAF50', marginTop: -1 },
  zoneInfoPanel: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#fff', padding: 18, borderRadius: 12, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 5 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusTagText: { fontSize: 12, fontWeight: 'bold' },
  activeZoneTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  activeZoneDetail: { fontSize: 14, color: '#666', marginBottom: 2 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50', marginRight: 8 },
  liveText: { fontSize: 13, fontWeight: '600' }
});