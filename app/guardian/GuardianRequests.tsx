import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { FlatList, RefreshControl, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../FirebaseConfig";
import BottomNav from "../../components/BottomNav";
import { useTheme } from "../../context/ThemeContext";

export default function GuardianRequests() {
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();

  const fetchRequests = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const mobile = userSnap.data().mobile;
        if (mobile) {
          const q = query(
            collection(db, "guardian_requests"), 
            where("guardian_phone", "==", mobile),
            where("status", "==", "pending")
          );
          const querySnapshot = await getDocs(q);
          setRequests(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAction = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      if (status === 'rejected') {
        // Permanently delete rejected requests to keep database clean
        await deleteDoc(doc(db, "guardian_requests", id));
      } else {
        await updateDoc(doc(db, "guardian_requests", id), { status });
      }
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchRequests().then(() => setRefreshing(false));
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Guardian Requests</Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        renderItem={({ item }) => (
          <View style={[styles.requestCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.textDark }]}>{item.student_name}</Text>
              <Text style={[styles.sub, { color: colors.subText }]}>wants to connect with you</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => handleAction(item.id, 'accepted')} style={[styles.btn, styles.accept, { backgroundColor: colors.primary }]}>
                <Text style={styles.btnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleAction(item.id, 'rejected')} style={[styles.btn, styles.reject, { backgroundColor: colors.accent }]}>
                <Text style={styles.btnText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.subText }]}>No pending requests.</Text>}
        contentContainerStyle={[styles.listContent, { backgroundColor: colors.background }]}
      />
      <BottomNav activeTab="Home" userType="Guardian" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { backgroundColor: "#4CAF50", height: 80, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 },
  backBtn: { marginRight: 15 },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  listContent: { padding: 20 },
  requestCard: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: 'transparent' },
  info: { marginBottom: 10 },
  name: { fontSize: 18, fontWeight: 'bold' },
  sub: { fontSize: 14, color: '#666' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  btn: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5, marginLeft: 10 },
  accept: { backgroundColor: '#4CAF50' },
  reject: { backgroundColor: '#FF5252' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 50, color: '#999' }
});
