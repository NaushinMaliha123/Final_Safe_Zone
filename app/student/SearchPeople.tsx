import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../FirebaseConfig";
import { useTheme } from "../../context/ThemeContext";

export default function SearchPeopleScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isInputFocused, setInputFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchMyRequests();
    // fetchAllUsersForSuggestions(); // Removed: Suggestions no longer shown on load
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchMyRequests().then(() => setRefreshing(false));
  }, []);

  const fetchMyRequests = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const q = query(collection(db, "guardian_requests"), where("student_uid", "==", user.uid));
      const snap = await getDocs(q);
      const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyRequests(reqs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async () => {
    if (searchQuery.length < 5) {
      Alert.alert("Error", "Please enter a valid phone number or name.");
      return;
    }

    setIsSearching(true);
    try {
      // Clean the search query
      const cleanSearch = searchQuery.trim();
      
      // Search by Mobile (Exact match)
      const q = query(
        collection(db, "users"), 
        where("mobile", "==", cleanSearch),
        where("userType", "==", "Guardian")
      );
      
      const querySnapshot = await getDocs(q);
      let foundUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // If no exact mobile match, try searching by Name but still filter by Guardian role
      if (foundUsers.length === 0) {
        const qName = query(
          collection(db, "users"),
          where("name", "==", cleanSearch),
          where("userType", "==", "Guardian")
        );
        const nameSnapshot = await getDocs(qName);
        foundUsers = nameSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      // Filter out current user and ONLY show Guardians
      const finalResults = foundUsers.filter((u: any) => 
        u.uid !== auth.currentUser?.uid && 
        u.userType === "Guardian"
      );
      
      setUsers(finalResults);
      if (finalResults.length === 0) {
        Alert.alert("No Results", "No user found with this number or name exactly.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const getRequestFor = (targetUid: string) => {
    return myRequests.find(r => r.target_uid === targetUid || r.guardian_phone === users.find(u => u.uid === targetUid)?.mobile);
  };

  const getStatus = (targetUid: string) => {
    const req = getRequestFor(targetUid);
    if (!req) return "none";
    return req.status; // 'pending', 'accepted'
  };

  const sendRequest = async (targetUser: any) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const requestData = {
        student_uid: user.uid,
        student_name: user.displayName || "Unknown",
        guardian_name: targetUser.name,
        guardian_phone: targetUser.mobile,
        target_uid: targetUser.uid,
        relationship: "Guardian",
        status: 'pending',
        timestamp: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "guardian_requests"), requestData);
      setMyRequests([...myRequests, { id: docRef.id, ...requestData }]);
      Alert.alert("Success", "Request sent!");
    } catch (e) {
      Alert.alert("Error", "Failed to send request.");
    }
  };

  // State to hold a pending cancel so user can undo
  const [undoPending, setUndoPending] = useState<null | { id: string; timer: number; req: any }>(null);

  const cancelRequest = (targetUid: string) => {
    const req = getRequestFor(targetUid);
    if (!req) return;

    // Optimistically remove request from UI
    setMyRequests(prev => prev.filter(r => r.id !== req.id));

    // Start a 5s timer before deleting from Firestore to allow undo
    const timer = setTimeout(async () => {
      try {
        await deleteDoc(doc(db, "guardian_requests", req.id));
      } catch (err) {
        console.error("Cancel request error:", err);
      } finally {
        setUndoPending(null);
      }
    }, 5000) as unknown as number;

    setUndoPending({ id: req.id, timer, req });
  };

  const undoCancel = () => {
    if (!undoPending) return;
    clearTimeout(undoPending.timer);
    // Restore locally; Firestore deletion was not performed yet
    setMyRequests(prev => [undoPending.req, ...prev]);
    setUndoPending(null);
  };

  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="dark-content" />
      
      {/* Search Header */}
      <View style={[styles.searchHeader, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        
        <View style={[
          styles.searchBarWrapper, 
          { 
            backgroundColor: colors.inputBg, 
            borderColor: isInputFocused ? colors.primary : colors.cardBorder,
            borderWidth: 1.5 
          }
        ]}>
          <MaterialIcons name="search" size={20} color={isInputFocused ? colors.primary : colors.subText} style={styles.searchBarIcon} />
          
          <TextInput
            style={[styles.searchInput, { color: colors.textDark }]}
            placeholder="Search guardian by phone..."
            placeholderTextColor={colors.placeholderText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            keyboardType="phone-pad"
            returnKeyType="search"
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
          
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => {
              setSearchQuery("");
              setUsers([]);
            }} style={styles.clearBtn}>
              <MaterialIcons name="close" size={20} color={colors.subText} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          onPress={handleSearch} 
          style={[styles.searchActionBtn, { backgroundColor: colors.primary }]}
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchActionText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={[styles.resultsList, { backgroundColor: colors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {isSearching ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
        ) : (
          users.map((item) => {
            const status = getStatus(item.uid);
            return (
              <View key={item.id} style={[styles.userCard, { backgroundColor: colors.cardBg, borderBottomColor: colors.cardBorder }]}>
                <View style={styles.avatar}>
                   <MaterialIcons name="account-circle" size={50} color={colors.subText} />
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: colors.textDark }]}>{item.name}</Text>
                  <Text style={[styles.userRole, { color: colors.subText }]}>{item.userType}</Text>
                </View>

                {status === "accepted" ? (
                  <View style={[styles.friendBadge, { backgroundColor: colors.isDark ? colors.background : '#e7f3ff' }]}>
                    <MaterialIcons name="check" size={16} color={colors.primary} />
                    <Text style={[styles.friendText, { color: colors.primary }]}>Friend</Text>
                  </View>
                ) : status === "pending" ? (
                  <Pressable
                    style={({ pressed }) => [styles.pendingBtn, { backgroundColor: colors.inputBg }, pressed && styles.pressedAction]}
                    onPress={() => cancelRequest(item.uid)}
                  >
                    <Text style={[styles.pendingText, { color: colors.text }]}>Requested</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary }, pressed && styles.pressedAction]}
                    onPress={() => sendRequest(item)}
                  >
                    <MaterialIcons name="person-add" size={18} color="#fff" />
                    <Text style={styles.addText}>Add Friend</Text>
                  </Pressable>
                )}
              </View>
            );
          })
        )}
        
        {!isSearching && users.length === 0 && searchQuery === "" && (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search" size={80} color={colors.isDark ? colors.cardBg : "#f0f0f0"} />
            <Text style={[styles.emptyText, { color: colors.subText }]}>Find your friends and guardians</Text>
          </View>
        )}
      </ScrollView>

      {undoPending && (
        <View style={styles.snackbar}>
          <Text style={styles.snackbarText}>Request cancelled</Text>
          <TouchableOpacity onPress={undoCancel} style={styles.snackbarBtn}>
            <Text style={styles.snackbarBtnText}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  searchHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backBtn: { padding: 5 },
  searchBarWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, paddingHorizontal: 15, marginLeft: 8 },
  searchBarIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: '100%', fontSize: 16, padding: 0 },
  loaderIcon: { marginLeft: 5 },
  clearBtn: { padding: 5, marginLeft: 5 },
  searchActionBtn: { marginLeft: 10, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', alignItems: 'center', height: 44 },
  searchActionText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  resultsList: { padding: 15 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { marginRight: 15 },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#1c1e21' },
  userRole: { fontSize: 13, color: '#65676b' },
  addBtn: { backgroundColor: '#1877f2', flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  addText: { color: '#fff', fontWeight: 'bold', marginLeft: 5, fontSize: 14 },
  pendingBtn: { backgroundColor: '#e4e6eb', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  pendingText: { color: '#4b4b4b', fontWeight: 'bold', fontSize: 14 },
  pressedAction: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  friendBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e7f3ff', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  friendText: { color: '#1877f2', fontWeight: 'bold', marginLeft: 4, fontSize: 14 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#999', marginTop: 10, fontSize: 16 },
  snackbar: { position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: '#323232', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 6 },
  snackbarText: { color: '#fff' },
  snackbarBtn: { marginLeft: 12, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 6 },
  snackbarBtnText: { color: '#1877f2', fontWeight: 'bold' },
});
