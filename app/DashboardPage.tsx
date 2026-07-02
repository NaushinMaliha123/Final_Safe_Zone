import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { auth, db } from "../FirebaseConfig";
import GuardianHome from "./guardian/home";
import StudentHome from "./student/home";

export default function DashboardScreen() {
  const [userType, setUserType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      // 1. Try to get cached role for instant start
      const cachedRole = await AsyncStorage.getItem("user_role");
      if (cachedRole) {
        setUserType(cachedRole);
        setLoading(false);
      }

      const user = auth.currentUser;
      const fetchFreshData = async (u: any) => {
        if (u) {
          const userSnap = await getDoc(doc(db, "users", u.uid));
          if (userSnap.exists()) {
            const freshType = userSnap.data().userType;
            if (freshType && freshType !== cachedRole) {
              setUserType(freshType);
              await AsyncStorage.setItem("user_role", freshType);
            }
          }
        }
        setLoading(false);
      };

      if (!user) {
        const unsubscribe = auth.onAuthStateChanged((u) => {
          fetchFreshData(u);
          unsubscribe();
        });
      } else {
        fetchFreshData(user);
      }
    };

    checkUser();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {userType === "Guardian" ? <GuardianHome /> : <StudentHome />}
    </SafeAreaProvider>
  );
}
