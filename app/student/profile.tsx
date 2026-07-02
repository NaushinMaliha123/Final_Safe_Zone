import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { doc, getDoc, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BottomNav from "../../components/BottomNav";
import { auth, db, getBackendUrl } from "../../FirebaseConfig";
import { useTheme } from "../../context/ThemeContext";

export default function StudentProfile() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const user = auth.currentUser;
  const { colors } = useTheme();
  
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [mobile, setMobile] = useState("");
  const [gender, setGender] = useState<string | null>(null);

  const fetchProfileData = async () => {
    if (user?.uid) {
      try {
        const cachedData = await AsyncStorage.getItem(`cached_profile_${user.uid}`);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          setDisplayName(parsed.name || "");
          setMobile(parsed.mobile || "");
          setGender(parsed.gender || "Female");
        }
      } catch (err) {
        console.error("Error reading profile cache:", err);
      }

      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDisplayName(data.name || "");
          setMobile(data.mobile || "");
          setGender(data.gender || "Female");
          
          await AsyncStorage.setItem(`cached_profile_${user.uid}`, JSON.stringify({
            name: data.name || "",
            mobile: data.mobile || "",
            gender: data.gender || "Female"
          }));
        } else {
          setGender("Female");
        }
      } catch (err) {
        console.error("Error fetching live profile data:", err);
      }
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [user]);

  const handleSave = async () => {
    if (user?.uid) {
      setIsEditing(false); // Optimistic update
      try {
        const userData = {
          name: displayName,
          mobile: mobile,
          gender: gender
        };

        // Cache immediately for instant responsiveness
        await AsyncStorage.setItem(`cached_profile_${user.uid}`, JSON.stringify(userData));

        // 1. Update Firebase Firestore
        await setDoc(doc(db, "users", user.uid), userData, { merge: true });

        // 2. Update MySQL Backend (optional, caught separately)
        try {
          await fetch(getBackendUrl(`/api/users/${user.uid}`), { 
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData),
          });
        } catch (backendError) {
          console.warn("MySQL backend update failed (server might be offline):", backendError);
        }

        Alert.alert("Success", "Profile updated successfully!");
      } catch (error) {
        console.error("Profile update error:", error);
        Alert.alert("Error", "Failed to update profile. Please try again.");
      }
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchProfileData().then(() => setRefreshing(false));
  }, []);

  const handleLogout = () => {
     auth.signOut().then(() => router.replace("/login"));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Student Profile</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialIcons name="logout" size={20} color="#fff" />
            <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { backgroundColor: colors.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          {gender ? (
            <Image 
              source={{ uri: gender === 'Male' ? 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png' : 'https://cdn-icons-png.flaticon.com/512/6833/6833605.png' }} 
              style={styles.avatar} 
            />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.isDark ? colors.background : '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
               <ActivityIndicator color={colors.primary} />
            </View>
          )}
          
          {isEditing ? (
            <View style={styles.form}>
              <View style={[styles.inputContainer, { backgroundColor: colors.inputBg }]}>
                <MaterialIcons name="person" size={20} color={colors.subText} style={styles.inputIcon} />
                <TextInput 
                  style={[styles.input, { color: colors.textDark }]} 
                  value={displayName} 
                  onChangeText={setDisplayName} 
                  placeholder="Full Name" 
                  placeholderTextColor={colors.placeholderText}
                />
              </View>

              <View style={[styles.inputContainer, { backgroundColor: colors.inputBg }]}>
                <MaterialIcons name="phone" size={20} color={colors.subText} style={styles.inputIcon} />
                <TextInput 
                  style={[styles.input, { color: colors.textDark }]} 
                  value={mobile} 
                  onChangeText={setMobile} 
                  placeholder="Mobile Number" 
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.placeholderText}
                />
              </View>
              
              <Text style={[styles.label, { color: colors.text }]}>Select Gender</Text>
              <View style={styles.genderRow}>
                {["Male", "Female"].map(item => (
                  <TouchableOpacity 
                    key={item} 
                    onPress={() => setGender(item)}
                    style={[
                      styles.genderBtn, 
                      { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                      gender === item && (item === 'Male' ? styles.maleBtnActive : styles.femaleBtnActive)
                    ]}
                  >
                    <MaterialIcons 
                      name={item === 'Male' ? 'male' : 'female'} 
                      size={18} 
                      color={gender === item ? '#fff' : colors.subText} 
                    />
                    <Text style={[styles.genderText, { color: colors.text }, gender === item && styles.genderTextActive]}> {item}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                  <MaterialIcons name="check" size={20} color="#fff" />
                  <Text style={styles.saveBtnText}> Save Changes</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                  <Text style={styles.cancelBtnText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.name, { color: colors.textDark }]}>{displayName || "Student Name"}</Text>
              <Text style={[styles.info, { color: colors.text }]}>{user?.email}</Text>
              <Text style={[styles.info, { color: colors.text }]}>Phone: {mobile || "Not set"}</Text>
              <Text style={[styles.info, { color: colors.text }]}>Gender: {gender}</Text>
              
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.primary }]} onPress={() => setIsEditing(true)}>
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      <BottomNav activeTab="Profile" userType="Student" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#4CAF50", height: 80, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  logoutBtn: { position: 'absolute', right: 20, alignItems: 'center' },
  logoutText: { color: '#fff', fontSize: 10, fontWeight: '600', marginTop: 2 },
  scrollContent: { padding: 20 },
  profileCard: { backgroundColor: "#fff", borderRadius: 15, padding: 20, alignItems: "center", elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, marginBottom: 20, borderWidth: 1, borderColor: "transparent" },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 15 },
  form: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 10, marginBottom: 15, paddingHorizontal: 12 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, fontSize: 16, color: '#333' },
  label: { fontSize: 14, color: '#666', marginBottom: 10, fontWeight: '600' },
  genderRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 20 },
  genderBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 25, borderRadius: 25, borderWidth: 1, borderColor: '#eee', marginHorizontal: 8, backgroundColor: '#fff' },
  maleBtnActive: { backgroundColor: '#2196F3', borderColor: '#2196F3' },
  femaleBtnActive: { backgroundColor: '#E91E63', borderColor: '#E91E63' },
  genderText: { fontSize: 15, color: '#666', fontWeight: '500' },
  genderTextActive: { color: '#fff', fontWeight: '700' },
  actionButtons: { marginTop: 10, alignItems: 'center' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CAF50', paddingVertical: 12, paddingHorizontal: 40, borderRadius: 25, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { marginTop: 15, padding: 5 },
  cancelBtnText: { color: '#888', textDecorationLine: 'underline' },
  name: { fontSize: 22, fontWeight: "bold", color: "#333" },
  info: { fontSize: 16, color: "#666", marginTop: 5 },
  editBtn: { backgroundColor: "#4CAF50", paddingVertical: 10, paddingHorizontal: 25, borderRadius: 8, marginTop: 20 },
  editBtnText: { color: "#fff", fontWeight: "bold" }
});
