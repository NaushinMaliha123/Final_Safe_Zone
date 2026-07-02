import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth, db, getBackendUrl } from "../FirebaseConfig";
import { useTheme } from "../context/ThemeContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { colors } = useTheme();

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleSignIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedEmail || !normalizedPassword) {
      alert("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, normalizedPassword);
      const user = userCredential.user;
      
      if (!user.emailVerified) {
        // Automatically delete the account if it's not verified 
        // to allow the user to register again with the same email.
        // Also delete from Firestore & MySQL if it exists there to completely clean up.
        try {
          const { deleteDoc, doc } = require("firebase/firestore");
          await deleteDoc(doc(db, "users", user.uid)).catch((e: any) => console.log("No doc to delete or err:", e));
          
          // Clean up from MySQL Database
          fetch(getBackendUrl(`/api/users/${user.uid}`), {
            method: "DELETE",
          }).catch((err) => console.log("MySQL cleanup skip/err (offline):", err));

          await user.delete();
          alert("Your email was not verified. The unverified account has been removed. Please sign up again and verify your email immediately.");
        } catch (deleteError) {
          console.error("Cleanup error:", deleteError);
          alert("Your email is not verified. Please check your inbox.");
        }
        setIsSubmitting(false);
        return;
      }

      // 1. Sync check: Ensure Firestore data exists and is clean
      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        
        if (!userSnap.exists()) {
          // If Firestore record is missing (deleted from admin/backend), 
          // delete the Auth account to stay in sync
          await user.delete();
          alert("This account has been deactivated. Please contact support.");
          setIsSubmitting(false);
          return;
        }

        // Cache user data so page7 doesn't need another Firestore fetch
        const userData = userSnap.data();
        if (userData?.userType) {
          await AsyncStorage.setItem("user_role", userData.userType);
          await AsyncStorage.setItem("user_name", userData.name || user.email?.split("@")[0] || "User");
        }
      } catch (syncError) {
        console.error("Auth-Firestore sync error:", syncError);
      }

      // Auto redirect to page7 and then it handles navigation based on role
      router.push("./page7");
    } catch (error: any) {
      alert(error.message || "Invalid credentials!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    alert("Password reset is coming soon. Please contact support.");
  };

  const handleGoogleSignIn = () => {
    alert("Google sign-in is not configured in demo mode.");
  };

  return (
    <ScrollView 
      contentContainerStyle={[styles.scrollContainer, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <MaterialIcons name="security" size={64} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textDark }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>Sign in to your SafeZone account</Text>

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textDark, borderColor: colors.inputBorder }]}
          placeholder="Enter email"
          placeholderTextColor={colors.placeholderText}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="none"
          value={email}
          onChangeText={setEmail}
        />
        <View style={[styles.passwordContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.textDark }]}
            placeholder="Enter password"
            placeholderTextColor={colors.placeholderText}
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoCorrect={false}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
            <MaterialIcons
              name={passwordVisible ? "visibility" : "visibility-off"}
              size={24}
              color={colors.subText}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.signInButton, { backgroundColor: colors.primary }, isSubmitting && styles.signInButtonDisabled]}
          onPress={handleSignIn}
          disabled={isSubmitting}
        >
          <Text style={styles.signInText}>{isSubmitting ? "Signing in..." : "Sign In"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={[styles.forgotPassword, { color: colors.primary }]}>Forgot Password?</Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          <Text style={[styles.orText, { color: colors.subText }]}>OR</Text>
          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
        </View>

        <TouchableOpacity style={[styles.googleButton, { borderColor: colors.inputBorder, backgroundColor: colors.cardBg }]} onPress={handleGoogleSignIn}>
          <AntDesign name="google" size={20} color="red" />
          <Text style={[styles.googleText, { color: colors.textDark }]}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={[styles.signupText, { color: colors.subText }]}>
          {"Don\'t have an account? "}
          <Text style={[styles.signupLink, { color: colors.primary }]} onPress={() => router.push("/signup")}>
            Sign Up
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1 },
  container: { flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 40 },
  title: { fontSize: 28, fontWeight: "bold", marginTop: 10, color: "#000" },
  subtitle: { fontSize: 14, color: "#555", marginBottom: 20 },
  input: { width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
  passwordContainer: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 12, marginBottom: 15, width: "100%" },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  signInButton: { backgroundColor: "#2e7d32", width: "100%", padding: 15, borderRadius: 8, alignItems: "center", marginBottom: 10 },
  signInText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  forgotPassword: { color: "#2e7d32", marginBottom: 20 },
  dividerContainer: { flexDirection: "row", alignItems: "center", marginVertical: 10, width: "100%" },
  divider: { flex: 1, height: 1, backgroundColor: "#ccc" },
  orText: { marginHorizontal: 10, color: "#555", fontWeight: "bold" },
  googleButton: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, width: "100%", justifyContent: "center", marginBottom: 20 },
  googleText: { marginLeft: 8, fontSize: 16, color: "#000" },
  signInButtonDisabled: { opacity: 0.6 },
  signupText: { fontSize: 14, color: "#555" },
  signupLink: { color: "#2e7d32", fontWeight: "bold" },
});