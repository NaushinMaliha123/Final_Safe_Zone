import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { auth, db } from "../FirebaseConfig";
import { useTheme } from "../context/ThemeContext";

export default function Page7() {
    const router = useRouter();
    const [firstName, setFirstName] = useState("");
    const [userType, setUserType] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const { colors } = useTheme();

    const fetchUserData = async () => {
        const user = auth.currentUser;
        if (user) {
            // Use cached name first for instant display
            const cachedName = await AsyncStorage.getItem("user_name");
            if (cachedName) {
                setFirstName(cachedName.split(" ")[0]);
            } else if (user.displayName) {
                setFirstName(user.displayName.split(" ")[0]);
            } else if (user.email) {
                const namePart = user.email.split("@")[0];
                setFirstName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
            } else {
                setFirstName("User");
            }

            // Use cached role first
            const cachedRole = await AsyncStorage.getItem("user_role");
            if (cachedRole) {
                setUserType(cachedRole);
            } else {
                try {
                    const userSnap = await getDoc(doc(db, "users", user.uid));
                    if (userSnap.exists()) {
                        const role = userSnap.data().userType;
                        setUserType(role);
                        await AsyncStorage.setItem("user_role", role);
                        const name = userSnap.data().name;
                        if (name) await AsyncStorage.setItem("user_name", name);
                    }
                } catch (err) {
                    console.error("Page7 fetch error:", err);
                }
            }
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    // Auto-redirect after 1.5 seconds — no manual button needed
    useEffect(() => {
        const timer = setTimeout(() => {
            router.replace("./DashboardPage");
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchUserData().then(() => setRefreshing(false));
    }, []);

    const handleContinue = () => {
        router.replace("./DashboardPage");
    };

    return (
        <ScrollView 
            contentContainerStyle={[styles.scrollContainer, { backgroundColor: colors.isDark ? colors.background : "#c8f0c8" }]}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
            }
        >
            <View style={[styles.container, { backgroundColor: colors.isDark ? colors.background : "#c8f0c8" }]}>
                <View style={styles.inner}>
                    <MaterialIcons name="security" size={70} color={colors.primary} />
                    <Text style={[styles.hello, { color: colors.textDark }]}>Hello, {firstName}</Text>
                    <Text style={[styles.welcome, { color: colors.text }]}>Welcome to {userType === 'Guardian' ? 'Guardian Portal' : 'Safety App'}</Text>
                </View>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.isDark ? colors.cardBg : "#fff", borderColor: colors.cardBorder }]}
                    onPress={handleContinue}
                >
                    <Text style={[styles.buttonText, { color: colors.primary }]}>Continue →</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: { flexGrow: 1 },
    container: { flex: 1, backgroundColor: "#c8f0c8", justifyContent: "space-between", alignItems: "center", paddingVertical: 80, paddingHorizontal: 20 },
    inner: { flex: 1, justifyContent: "center", alignItems: "center" },
    hello: { fontSize: 26, fontWeight: "bold", color: "#000", marginTop: 20 },
    welcome: { fontSize: 16, color: "#333", marginTop: 8 },
    button: { backgroundColor: "#fff", paddingVertical: 16, paddingHorizontal: 60, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: "transparent" },
    buttonText: { fontSize: 18, color: "#2e7d32", fontWeight: "600" },
});