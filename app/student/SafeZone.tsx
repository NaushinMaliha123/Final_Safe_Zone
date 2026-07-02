import { MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { addDoc, collection, deleteDoc, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../FirebaseConfig";
import { useTheme } from "../../context/ThemeContext";

export default function SafeZone() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const [zoneName, setZoneName] = useState("");
  const [radius, setRadius] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [showMapModal, setShowMapModal] = useState(false);
  const [region, setRegion] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [selectedZoneForActive, setSelectedZoneForActive] = useState<any>(null);

  const ZOOM_LEVEL = {
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const durationOptions = [
    { label: "30 Mnt", value: 30 },
    { label: "1 Hour", value: 60 },
    { label: "2 Hours", value: 120 },
    { label: "5 Hours", value: 300 },
    { label: "10 Hours", value: 600 },
    { label: "Until Deactivated", value: -1 },
  ];

  // Function to fetch suggestions as user types
  const handleTextChange = async (text: string) => {
    setSearchQuery(text);
    if (text.length > 2) {
      try {
        // useGeocodeAsync with useGoogleMaps: false (default) sometimes returns few results.
        // We can try to improve this by searching specifically for addresses.
        const results = await Location.geocodeAsync(text);
        
        if (results.length > 0) {
          const formattedSuggestions = [];
          
          // Expo geocode often returns coordinates. To get multiple text suggestions similar to Google, 
          // we reverse geocode each coordinate to get a proper address string.
          // Increase limit to 8 for better variety.
          const topResults = results.slice(0, 8);
          
          for (const res of topResults) {
            const reverse = await Location.reverseGeocodeAsync({
              latitude: res.latitude,
              longitude: res.longitude
            });
            
            if (reverse.length > 0) {
              const addr = reverse[0];
              // Construct a more detailed address string
              const part1 = addr.name || addr.street || "";
              const part2 = addr.district || addr.city || "";
              const part3 = addr.region || addr.subregion || "";
              const part4 = addr.country || "";
              
              const fullAddress = [part1, part2, part3, part4]
                .filter(Boolean)
                .join(", ");

              formattedSuggestions.push({
                display: fullAddress,
                coords: res,
                shortName: part1 || text
              });
            }
          }

          // Remove duplicates based on display string
          const uniqueSuggestions = formattedSuggestions.filter(
            (v, i, a) => a.findIndex(t => t.display === v.display) === i
          );
          
          setSuggestions(uniqueSuggestions);
        }
      } catch (e) {
        console.log("Suggestion error:", e);
      }
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (item: any) => {
    const { latitude, longitude } = item.coords;
    setRegion({
      ...region,
      latitude,
      longitude,
      ...ZOOM_LEVEL,
    });
    setZoneName(item.shortName);
    setSearchQuery(item.display);
    setSuggestions([]);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        
        // Use a temp region to force update properly
        const newReg = {
          latitude,
          longitude,
          ...ZOOM_LEVEL,
        };
        setRegion(newReg);
        
        // Reverse geocode to get a better name if needed
        const address = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (address.length > 0) {
          const place = address[0];
          setZoneName(place.name || place.street || searchQuery);
        }
      } else {
        Alert.alert("Not Found", "Location not found. Please try a different search.");
      }
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert("Error", "Failed to search location.");
    } finally {
      setIsSearching(false);
      setSuggestions([]); // Clear suggestions after search
    }
  };

  const fetchZones = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const q = query(collection(db, "safe_zones"), where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const list = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let isActive = data.isActive || false;
        
        // Check if duration expired
        if (isActive && data.activeUntil) {
          const expiration = data.activeUntil.toDate();
          if (expiration < new Date()) {
            isActive = false;
            // Silently update Firestore that it's expired
            updateDoc(doc.ref, { isActive: false, activeUntil: null });
            
            // Show alert for the user
            Alert.alert(
              "Zone Expired",
              `Your duration for ${data.name} has ended. You can reactivate it to stay protected.`,
              [{ text: "OK" }]
            );
          }
        }
        
        return { id: doc.id, ...data, isActive };
      });
      setZones(list);
    } catch (err) {
      console.error("Fetch zones error:", err);
    }
  };

  useEffect(() => {
    fetchZones();
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Allow location access to set your current location.');
      return;
    }

    let location = await Location.getCurrentPositionAsync({});
    const newRegion = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      ...ZOOM_LEVEL,
    };
    setRegion(newRegion);

    // Also update Firestore to keep it in sync
    const user = auth.currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        lastLocationUpdate: new Date(),
      }).catch(e => console.log("Sync error:", e));
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchZones().then(() => setRefreshing(false));
  }, []);

  const handleAddZone = async () => {
    if (!zoneName || !radius) {
      Alert.alert("Error", "Please enter zone name and radius");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setIsLoading(true);
    try {
      const zoneData = {
        userId: user.uid,
        name: zoneName,
        radius: parseInt(radius),
        latitude: region.latitude,
        longitude: region.longitude,
        updatedAt: new Date(),
      };

      if (editingId) {
        // Update existing zone
        await updateDoc(doc(db, "safe_zones", editingId), zoneData);
        Alert.alert("Success", "Safe Zone updated successfully");
      } else {
        // Add new zone
        await addDoc(collection(db, "safe_zones"), { ...zoneData, createdAt: new Date() });
        Alert.alert("Success", "Safe Zone added successfully");
      }

      setZoneName("");
      setRadius("");
      setEditingId(null);
      setIsAdding(false); 
      fetchZones();
    } catch (err) {
      console.error("Add/Update zone error:", err);
      Alert.alert("Error", "Failed to save safe zone");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditZone = (item: any) => {
    setEditingId(item.id);
    setZoneName(item.name);
    setRadius(item.radius.toString());
    setRegion({
      latitude: item.latitude,
      longitude: item.longitude,
      ...ZOOM_LEVEL,
    });
    setIsAdding(true);
  };

  const handleDeleteZone = async (id: string) => {
    Alert.alert("Delete Zone", "Are you sure you want to delete this zone permanently from Database and Firebase?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            // This deletes the document directly from Firebase Firestore using its unique ID
            await deleteDoc(doc(db, "safe_zones", id));
            
            // UI refreshing to show the updated list
            fetchZones();
            Alert.alert("Deleted", "Safe Zone has been permanently removed.");
          } catch (err) {
            console.error("Delete zone error:", err);
            Alert.alert("Error", "Failed to delete the zone. Please try again.");
          }
        }
      }
    ]);
  };

  const toggleActiveZone = async (zone: any, durationMinutes: number) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // 1. Deactivate any currently active zone for this user
      const activeQuery = query(
        collection(db, "safe_zones"),
        where("userId", "==", user.uid),
        where("isActive", "==", true)
      );
      const activeSnapshot = await getDocs(activeQuery);
      
      const batch: any[] = [];
      activeSnapshot.forEach((docSnap) => {
        batch.push(updateDoc(doc(db, "safe_zones", docSnap.id), { 
          isActive: false, 
          activeUntil: null 
        }));
      });
      await Promise.all(batch);

      // 2. Activate the new zone if it wasn't already active (or user is changing duration)
      if (zone.isActive && durationMinutes === 0) {
        // Just toggling off
        Alert.alert("Deactivated", `${zone.name} is no longer your active safe zone.`);
      } else {
        const activeUntil = durationMinutes === -1 
          ? null 
          : new Date(Date.now() + durationMinutes * 60000);

        await updateDoc(doc(db, "safe_zones", zone.id), {
          isActive: true,
          activeUntil: activeUntil
        });
        
        Alert.alert(
          "Zone Activated", 
          `${zone.name} is now your active safe zone${durationMinutes === -1 ? "." : ` for ${durationMinutes} minutes.`}`
        );
      }

      setShowDurationModal(false);
      fetchZones();
    } catch (err) {
      console.error("Toggle active error:", err);
      Alert.alert("Error", "Failed to update active zone.");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      
      {/* Header (page9 style) */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Safe Zones</Text>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
        nestedScrollEnabled={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Manage Safe Zones Card (Top Box) */}
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardHeader, { color: colors.textDark }]}>
              {editingId ? "Edit Safe Zone" : "Manage Safe Zones"}
            </Text>
            {!isAdding && (
              <TouchableOpacity onPress={() => {
                setEditingId(null);
                setZoneName("");
                setRadius("");
                setIsAdding(true);
              }} style={styles.headerAddBtn}>
                <MaterialIcons name="add-circle" size={24} color={colors.primary} />
                <Text style={[styles.headerAddText, { color: colors.primary }]}>Add New</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {isAdding ? (
            <View style={styles.formContainer}>
              <Text style={[styles.label, { color: colors.textDark }]}>Zone Name (e.g., Home, School)</Text>
              <View style={[styles.inputWithIcon, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <TextInput 
                  placeholder="Zone Name" 
                  style={[styles.inputFlex, { color: colors.textDark }]} 
                  placeholderTextColor={colors.placeholderText} 
                  value={zoneName}
                  onChangeText={setZoneName}
                />
                <TouchableOpacity onPress={() => setShowMapModal(true)} style={styles.inputMapBtn}>
                  <MaterialIcons name="place" size={22} color="#EA4335" />
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.label, { color: colors.textDark }]}>Radius (meters)</Text>
              <TextInput 
                placeholder="e.g. 100" 
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textDark, borderColor: colors.inputBorder }]} 
                keyboardType="numeric" 
                placeholderTextColor={colors.placeholderText} 
                value={radius}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, '');
                  setRadius(cleaned);
                }}
              />

              {/* Integrated Map View inside Form */}
              <Text style={[styles.label, { color: colors.textDark }]}>Safe Zone Preview (Tap to move)</Text>
              <View style={[styles.formMapContainer, { borderColor: colors.cardBorder }]}>
                {region ? (
                  <View style={{ width: '100%', height: '100%' }}>
                    <MapView 
                      style={StyleSheet.absoluteFillObject}
                      initialRegion={region}
                      region={region} 
                      showsUserLocation={true}
                      showsMyLocationButton={true}
                      scrollEnabled={false}
                      zoomEnabled={true}
                      pitchEnabled={false}
                      rotateEnabled={false}
                    >
                      <Marker 
                        coordinate={{ latitude: region.latitude, longitude: region.longitude }} 
                        pinColor="blue" 
                      />
                      {radius !== "" && (
                        <Circle 
                          center={{ latitude: region.latitude, longitude: region.longitude }} 
                          radius={parseInt(radius) || 100} 
                          strokeColor="rgba(0,255,0,0.8)" 
                          fillColor="rgba(0,255,0,0.3)" 
                          strokeWidth={2}
                        />
                      )}
                    </MapView>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ marginTop: 5, fontSize: 12, color: colors.subText }}>Loading map...</Text>
                  </View>
                )}
              </View>

              <View style={styles.formActions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.cancelBtn]} 
                  onPress={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    setZoneName("");
                    setRadius("");
                  }}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.subText }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, styles.saveBtn, { backgroundColor: colors.primary }]} 
                  onPress={handleAddZone} 
                  disabled={isLoading}
                >
                  <Text style={styles.saveBtnText}>
                    {isLoading ? "Saving..." : (editingId ? "Update Zone" : "Save Zone")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={[styles.manageDescText, { color: colors.subText }]}>Add or update your safe zones to keep your guardians informed about your activity.</Text>
          )}
        </View>

        {/* Saved Zones List Card (Separate Box) */}
        {!isAdding && zones.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[styles.cardHeader, { color: colors.textDark }]}>Saved Safe Zones</Text>
            <View style={{ marginTop: 10 }}>
              {zones.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.subText }]}>No safe zones saved yet.</Text>
              ) : (
                zones.map((item) => (
                  <View key={item.id} style={[styles.zoneListItem, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
                    <View style={[styles.zoneIconContainer, { backgroundColor: colors.isDark ? colors.background : "#E8F5E9" }]}>
                      <MaterialIcons name="security" size={24} color={colors.primary} />
                    </View>
                    <View style={styles.zoneInfoContainer}>
                      <Text style={[styles.zoneNameText, { color: colors.textDark }]}>{item.name}</Text>
                      <Text style={[styles.zoneSubInfo, { color: colors.subText }]}>{item.radius}m</Text>
                      {item.isActive && (
                        <View style={styles.activeLabel}>
                          <Text style={styles.activeLabelText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity 
                      style={[styles.activationBtn, item.isActive && styles.activeModeBtn]} 
                      onPress={() => {
                        if (item.isActive) {
                          toggleActiveZone(item, 0);
                        } else {
                          setSelectedZoneForActive(item);
                          setShowDurationModal(true);
                        }
                      }}
                    >
                      <MaterialIcons 
                        name={item.isActive ? "location-on" : "location-off"} 
                        size={20} 
                        color={item.isActive ? "#fff" : colors.subText} 
                      />
                    </TouchableOpacity>

                    <TouchableOpacity 
                      onPress={() => {
                        Alert.alert(
                          "Options",
                          "What would you like to do?",
                          [
                            { text: "Edit", onPress: () => handleEditZone(item) },
                            { text: "Delete", style: "destructive", onPress: () => handleDeleteZone(item.id) },
                            { text: "Cancel", style: "cancel" }
                          ]
                        );
                      }} 
                      style={styles.moreBtn}
                    >
                      <MaterialIcons name="more-vert" size={24} color={colors.subText} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Duration Selection Modal */}
        <Modal
          visible={showDurationModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDurationModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.durationCard}>
              <Text style={styles.durationTitle}>Activate {selectedZoneForActive?.name}</Text>
              <Text style={styles.durationSub}>Select for how long you want to stay in this safe zone:</Text>
              
              <View style={styles.durationOptionsList}>
                {durationOptions.map((opt) => (
                  <TouchableOpacity 
                    key={opt.label} 
                    style={styles.durationOpt}
                    onPress={() => toggleActiveZone(selectedZoneForActive, opt.value)}
                  >
                    <Text style={styles.durationOptText}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.durationCancelBtn}
                onPress={() => setShowDurationModal(false)}
              >
                <Text style={styles.durationCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Map Selection Modal */}
        <Modal
          visible={showMapModal}
          animationType="slide"
          onRequestClose={() => setShowMapModal(false)}
        >
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={[styles.modalHeader, { backgroundColor: colors.headerBg, borderBottomColor: colors.cardBorder }]}>
              <TouchableOpacity onPress={() => setShowMapModal(false)} style={styles.modalCloseBtn}>
                <MaterialIcons name="arrow-back" size={24} color={colors.headerText} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.headerText }]}>Set Location</Text>
              <TouchableOpacity onPress={() => setShowMapModal(false)}>
                <Text style={[styles.modalDoneText, { color: colors.headerText }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              {region ? (
                <MapView 
                  style={styles.map} 
                  initialRegion={region}
                  showsUserLocation={true}
                  showsMyLocationButton={true}
                  onRegionChangeComplete={(r) => {
                    // Update only delta/zoom when user moves map manually
                    setRegion((prev: any) => ({
                      ...prev,
                      latitudeDelta: r.latitudeDelta,
                      longitudeDelta: r.longitudeDelta,
                    }));
                  }}
                  onPress={(e) => {
                    setRegion({ ...region, ...e.nativeEvent.coordinate });
                    setSuggestions([]);
                  }}
                >
                  <Marker 
                    coordinate={{ latitude: region.latitude, longitude: region.longitude }} 
                    draggable
                    onDragEnd={(e) => setRegion({ ...region, ...e.nativeEvent.coordinate })}
                  />
                </MapView>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ marginTop: 10, color: colors.text }}>Fetching current location...</Text>
                </View>
              )}

              {/* Floating Search Bar like Google Maps */}
              <View style={styles.floatingSearchContainer}>
                <View style={styles.googleSearchBox}>
                  <MaterialIcons name="search" size={22} color="#70757a" style={{marginRight: 10}} />
                  <TextInput
                    placeholder="Search here"
                    style={styles.googleSearchInput}
                    value={searchQuery}
                    onChangeText={handleTextChange}
                    onSubmitEditing={handleSearch}
                    placeholderTextColor="#70757a"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => {setSearchQuery(""); setSuggestions([]);}}>
                      <MaterialIcons name="close" size={20} color="#70757a" />
                    </TouchableOpacity>
                  )}
                  <View style={styles.searchSeparator} />
                  <TouchableOpacity onPress={getCurrentLocation}>
                    <MaterialIcons name="my-location" size={22} color="#1a73e8" />
                  </TouchableOpacity>
                </View>

                {suggestions.length > 0 && (
                  <ScrollView 
                    style={styles.googleSuggestionsList}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                  >
                    {suggestions.map((item, index) => (
                      <TouchableOpacity 
                        key={index} 
                        style={styles.googleSuggestionItem}
                        onPress={() => selectSuggestion(item)}
                      >
                        <View style={styles.suggestionIconWrapper}>
                          <MaterialIcons name="location-on" size={20} color="#70757a" />
                        </View>
                        <View style={styles.suggestionTextWrapper}>
                          <Text style={styles.suggestionMainText} numberOfLines={1}>{item.shortName}</Text>
                          <Text style={styles.suggestionSubText} numberOfLines={1}>{item.display}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Action Button at bottom */}
              <TouchableOpacity 
                style={styles.confirmLocationFab}
                onPress={async () => {
                  try {
                    // Fetch address for the current pinned location before closing
                    const address = await Location.reverseGeocodeAsync({ 
                      latitude: region.latitude, 
                      longitude: region.longitude 
                    });
                    if (address.length > 0) {
                      const place = address[0];
                      const name = place.name || place.street || place.district || "New Zone";
                      setZoneName(name);
                    }
                  } catch (error) {
                    console.log("Reverse geocode error on confirm:", error);
                  }
                  setShowMapModal(false);
                }}
              >
                <Text style={styles.confirmLocationFabText}>Confirm Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Removed Map View Card from outside as it is now inside the add form */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#4CAF50", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 50, paddingBottom: 20 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold", textAlign: "center", flex: 1 },
  backBtn: { width: 40 },
  notificationBtn: { width: 40, alignItems: "flex-end" },
  badge: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF5252", position: "absolute", top: 0, right: 0, borderWidth: 1.5, borderColor: "#4CAF50" },
  scrollContent: { padding: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#eee", elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardHeader: { fontSize: 16, fontWeight: "bold", color: "#000" },
  cardHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  headerAddBtn: { 
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  headerAddText: { 
    color: '#4CAF50', 
    fontWeight: 'bold', 
    marginLeft: 5,
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
    fontSize: 14,
  },
  formContainer: {
    marginTop: 5,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionBtn: {
    flex: 0.48,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: '#4CAF50',
  },
  cancelBtn: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelBtnText: {
    color: '#666',
    fontWeight: 'bold',
  },
  editBtn: {
    padding: 8,
    marginRight: 5,
  },
  zoneListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  zoneIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  zoneInfoContainer: {
    flex: 1,
  },
  zoneSubInfo: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  zoneNameText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333"
  },
  manageDescText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  moreBtn: {
    padding: 8,
    marginLeft: 5,
  },
  activeLabel: {
    backgroundColor: '#E8F5E9',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  activeLabelText: {
    color: '#4CAF50',
    fontSize: 10,
    fontWeight: 'bold',
  },
  activationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activeModeBtn: {
    backgroundColor: '#4CAF50',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  durationCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '100%',
    elevation: 5,
  },
  durationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  durationSub: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  durationOptionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  durationOpt: {
    width: '48%',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  durationOptText: {
    color: '#333',
    fontWeight: '500',
  },
  durationCancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  durationCancelText: {
    color: '#FF5252',
    fontWeight: 'bold',
  },
  label: { fontSize: 13, color: "#333", marginBottom: 5, fontWeight: "600" },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 15,
    paddingRight: 10,
  },
  formMapContainer: {
    height: 350,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputFlex: {
    flex: 1,
    padding: 12,
    fontSize: 14,
    color: "#000",
  },
  inputMapBtn: {
    padding: 5,
  },
  input: { backgroundColor: "#f5f5f5", borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 14, color: "#000", borderWidth: 1, borderColor: "#e0e0e0" },
  addButton: { backgroundColor: "#4CAF50", paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 5 },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  zoneItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eee" },
  zoneName: { fontSize: 15, fontWeight: "bold", color: "#333" },
  zoneInfo: { fontSize: 12, color: "#777" },
  mapContainer: { height: 300, borderRadius: 12, overflow: "hidden", marginTop: 5 },
  map: { flex: 1 },
  inputHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  googleMapFab: {
    backgroundColor: "#fff",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  googleMapCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 15, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingTop: 40 },
  modalCloseBtn: { padding: 5 },
  modalTitle: { fontSize: 17, fontWeight: "600", color: '#333' },
  modalDoneText: { color: "#4CAF50", fontWeight: "bold", fontSize: 15 },
  
  floatingSearchContainer: {
    position: 'absolute',
    top: 15,
    left: 15,
    right: 15,
    zIndex: 10,
  },
  googleSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 15,
    height: 50,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  googleSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    height: '100%',
  },
  searchSeparator: {
    width: 1,
    height: 25,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  googleSuggestionsList: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginTop: 8,
    maxHeight: 300,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  googleSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  suggestionIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f3f4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  suggestionTextWrapper: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 15,
    color: '#202124',
    fontWeight: '500',
  },
  suggestionSubText: {
    fontSize: 13,
    color: '#70757a',
    marginTop: 2,
  },
  confirmLocationFab: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    backgroundColor: '#4CAF50',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  confirmLocationFabText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentLocationBtn: { position: "absolute", bottom: 20, right: 20, backgroundColor: "#fff", padding: 10, borderRadius: 30, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
});
