import { MaterialIcons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import { useRouter } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import React, { useState } from "react";
import { Alert, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db, getBackendUrl } from "../../FirebaseConfig";
import { useTheme } from "../../context/ThemeContext";

export default function AddGuardianScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [parentName, setParentName] = useState("");

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const [parentPhone, setParentPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const loadContacts = async () => {
    setIsLoading(true);
    const { status } = await Contacts.requestPermissionsAsync();
    
    if (status === "granted") {
      try {
        const contact = await Contacts.presentContactPickerAsync();
        if (contact) {
          let fullName = contact.name;
          if (!fullName) {
            fullName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
          }
          const phoneNumber = (contact.phoneNumbers && contact.phoneNumbers.length > 0) 
            ? contact.phoneNumbers[0].number 
            : "";
          setParentName(fullName || "");
          setParentPhone(phoneNumber || "");
        }
      } catch (error) {
        console.log("Contact picker error:", error);
      }
    } else {
      Alert.alert("Permission Denied", "We need permission to access your contacts.");
    }
    setIsLoading(false);
  };

  const handleSendRequest = async () => {
    if (!parentName || !parentPhone || !relationship) {
      Alert.alert("Error", "Please fill all fields including relationship");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setIsLoading(true);
    try {
      const requestData = {
        student_id: user.uid,
        student_uid: user.uid,
        student_name: user.displayName || user.email?.split("@")[0],
        guardian_name: parentName,
        guardian_phone: parentPhone.replace(/\s/g, ''), // remove spaces
        relationship: relationship,
        status: 'pending',
        timestamp: serverTimestamp(),
      };

      // 1. Save to Firebase Firestore
      await addDoc(collection(db, "guardian_requests"), requestData);

      // 2. Save to MySQL Backend
      await fetch(getBackendUrl("/api/guardian-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
      });

      Alert.alert("Success", `Guardian Request Sent to ${parentName}`);
      setParentName("");
      setParentPhone("");
      setRelationship("");
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to send request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Add Guardian</Text>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardHeader, { color: colors.textDark }]}>Invite a Guardian</Text>
          <Text style={[styles.cardSubHeader, { color: colors.subText }]}>Guardians can see your real-time location and receive alerts.</Text>

          <TouchableOpacity 
            style={[styles.contactsButton, { borderColor: colors.primary, backgroundColor: colors.isDark ? colors.background : "#f0fdf4" }]} 
            onPress={loadContacts}
            disabled={isLoading}
          >
            <MaterialIcons name="contacts" size={20} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.contactsButtonText, { color: colors.primary }]}>
              {isLoading ? "Loading..." : "Choose From Phone Contacts"}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.label, { color: colors.textDark }]}>Full Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textDark, borderColor: colors.inputBorder }]}
            placeholder="e.g. Naushin Maliha"
            value={parentName}
            onChangeText={setParentName}
            placeholderTextColor={colors.placeholderText}
          />
          
          <Text style={[styles.label, { color: colors.textDark }]}>Phone Number</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textDark, borderColor: colors.inputBorder }]}
            placeholder="e.g. +01XXXXXXXXX"
            keyboardType="phone-pad"
            value={parentPhone}
            onChangeText={setParentPhone}
            placeholderTextColor={colors.placeholderText}
          />

          <Text style={[styles.label, { color: colors.textDark }]}>Relationship</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textDark, borderColor: colors.inputBorder }]}
            placeholder="e.g. Father, Mother, Friend"
            value={relationship}
            onChangeText={setRelationship}
            placeholderTextColor={colors.placeholderText}
          />

          <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }]} onPress={handleSendRequest}>
            <MaterialIcons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.sendButtonText}>Send Request</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={[styles.cancelButtonText, { color: colors.subText }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#4CAF50", height: 100, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 30 },
  backButton: { width: 40 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "500", textAlign: "center", flex: 1 },
  notificationBtn: { width: 40, alignItems: "flex-end", position: "relative" },
  badge: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF5252", position: "absolute", top: 0, right: 0, borderWidth: 1, borderColor: "#4CAF50" },
  container: { padding: 20, paddingTop: 30 },
  card: { backgroundColor: "#fff", borderRadius: 15, padding: 24, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, borderWidth: 1, borderColor: "#f0f0f0" },
  cardHeader: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  cardSubHeader: { fontSize: 14, color: '#666', marginBottom: 30, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  input: { backgroundColor: "#f9f9f9", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20, fontSize: 16, borderWidth: 1, borderColor: "#eee", color: "#333" },
  contactsButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 10, borderWidth: 1, borderColor: "#4CAF50", borderStyle: 'dashed', marginBottom: 30, backgroundColor: "#f0fdf4" },
  contactsButtonText: { color: "#4CAF50", fontWeight: "bold", fontSize: 15 },
  sendButton: { backgroundColor: "#4CAF50", borderRadius: 10, paddingVertical: 16, alignItems: "center", flexDirection: 'row', justifyContent: 'center', marginTop: 10, elevation: 2 },
  sendButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  cancelButton: { paddingVertical: 16, alignItems: "center", marginTop: 10 },
  cancelButtonText: { color: "#999", fontSize: 15, fontWeight: "500" },
});
