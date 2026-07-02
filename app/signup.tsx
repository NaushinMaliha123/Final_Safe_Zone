import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth, db, getBackendUrl } from "../FirebaseConfig";
import { useTheme } from "../context/ThemeContext";

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [userType, setUserType] = useState("Student");
  const [gender, setGender] = useState("Male");
  const [agreed, setAgreed] = useState(false);   // <-- checkbox state
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

  const handleCreateAccount = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !mobile.trim() || !password.trim()) {
      alert("Please fill all fields before creating an account.");
      return;
    }

    if (!email.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }

    if (mobile.trim().length < 10) {
      alert("Please enter a valid phone number.");
      return;
    }

    if (!agreed) {
      alert("You must agree to the terms to continue.");
      return;
    }

    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
      const user = userCredential.user;

      const trimmedFirstName = firstName.trim();
      const fullName = `${trimmedFirstName} ${lastName.trim()}`;

      // Update Firebase Profile with display name
      await updateProfile(user, { displayName: fullName });

      // 1. Send Verification Email immediately
      try {
        await sendEmailVerification(user);
      } catch (mailError) {
        console.error("Email verification error:", mailError);
        // If email verification sending fails, we should delete the auth account 
        // immediately so they aren't stuck with an unverified account they can't verify
        try {
          await user.delete();
        } catch (dErr) {
          console.error("Cleanup failed:", dErr);
        }
        alert("Failed to send verification email. Please try again with a valid email.");
        setIsSubmitting(false);
        return;
      }

      // 2. Save user info to MySQL & Firebase Firestore in background ONLY after success verification try
      const userData = {
        uid: user.uid,
        name: fullName,
        email: email.trim(),
        mobile: mobile.trim(),
        userType: userType,
        gender: gender,
      };

      // Save to Firebase Firestore
      setDoc(doc(db, "users", user.uid), userData).catch(err => console.error("Firebase Firestore save error:", err));

      // Save to MySQL (Set timeout fallback for fetch to avoid red error screen during test)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout limit

      fetch(getBackendUrl("/api/users"), { 
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
        signal: controller.signal
      })
      .then(() => clearTimeout(timeoutId))
      .catch(err => {
        clearTimeout(timeoutId);
        console.warn("Background MySQL save skipped/aborted (Server offline/disconnected). Cleaned up cleanly.");
      });

      alert("Verification email sent! Please check your inbox (and SPAM folder) and verify your email before logging in.");
      setIsSubmitting(false);
      router.push("/login");
    } catch (error: any) {
      alert(error.message || "Failed to create account.");
      setIsSubmitting(false);
    }
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
        <Text style={[styles.title, { color: colors.textDark }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: colors.subText }]}>Join SafeZone for better safety</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.halfInput, { backgroundColor: colors.inputBg, color: colors.textDark, borderColor: colors.inputBorder }]}
            placeholder="First Name"
            placeholderTextColor={colors.placeholderText}
            value={firstName}
            onChangeText={setFirstName}
          />
          <TextInput
            style={[styles.input, styles.halfInput, { backgroundColor: colors.inputBg, color: colors.textDark, borderColor: colors.inputBorder }]}
            placeholder="Last Name"
            placeholderTextColor={colors.placeholderText}
            value={lastName}
            onChangeText={setLastName}
          />
        </View>

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

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textDark, borderColor: colors.inputBorder }]}
          placeholder="Enter phone number"
          placeholderTextColor={colors.placeholderText}
          keyboardType="phone-pad"
          value={mobile}
          onChangeText={setMobile}
        />

        {/* User Type Selection */}
        <View style={styles.userTypeContainer}>
          {["Student", "Guardian"].map(type => (
            <TouchableOpacity
              key={type}
              style={[
                styles.userTypeButton,
                { borderColor: colors.inputBorder, backgroundColor: colors.cardBg },
                userType === type && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => setUserType(type)}
            >
              <Text style={[styles.userTypeText, { color: colors.textDark }, userType === type && { color: "#fff" }]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Gender Selection */}
        <Text style={[styles.label, { color: colors.text }]}>Select Gender</Text>
        <View style={styles.userTypeContainer}>
          {["Male", "Female", "Other"].map(item => (
            <TouchableOpacity
              key={item}
              style={[
                styles.userTypeButton,
                { borderColor: colors.inputBorder, backgroundColor: colors.cardBg },
                gender === item && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
              onPress={() => setGender(item)}
            >
              <Text style={[styles.userTypeText, { color: colors.textDark }, gender === item && { color: "#fff" }]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Terms Checkbox */}
        <TouchableOpacity 
          style={styles.checkboxContainer} 
          onPress={() => setAgreed(!agreed)}
        >
          <MaterialIcons 
            name={agreed ? "check-box" : "check-box-outline-blank"} 
            size={20} 
            color={agreed ? colors.primary : colors.subText} 
          />
          <Text style={[styles.checkboxText, { color: colors.subText }]}>
            I agree to the Terms of Service and Privacy Policy
          </Text>
        </TouchableOpacity>

        {/* Create Account Button */}
        <TouchableOpacity 
          style={[styles.signInButton, { backgroundColor: colors.primary }, (!agreed || isSubmitting) && { opacity: 0.5 }]} 
          disabled={!agreed || isSubmitting}
          onPress={handleCreateAccount}
        >
          <Text style={styles.signInText}>
            {isSubmitting ? "Creating an account..." : "Create Account"}
          </Text>
        </TouchableOpacity>

        {/* Navigate back to Login */}
        <Text style={[styles.signupText, { color: colors.subText }]}>
          Already have an account?{" "}
          <Text style={[styles.signupLink, { color: colors.primary }]} onPress={() => router.push("/login")}>
            Sign In
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1 },
  container: { flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 40 },
  label: { width: '100%', fontSize: 14, fontWeight: 'bold', color: '#555', marginBottom: 5, marginTop: 10 },
  title: { fontSize: 28, fontWeight: "bold", marginTop: 10, color: "#000" },
  subtitle: { fontSize: 14, color: "#555", marginBottom: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  input: { width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
  halfInput: { width: "48.5%" },
  passwordContainer: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#ccc", borderRadius: 8, paddingHorizontal: 12, marginBottom: 15, width: "100%" },
  passwordInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  signInButton: { backgroundColor: "#2e7d32", width: "100%", padding: 15, borderRadius: 8, alignItems: "center", marginBottom: 10 },
  signInText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  userTypeContainer: { flexDirection: "row", marginBottom: 15 },
  userTypeButton: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginHorizontal: 5 },
  userTypeSelected: { backgroundColor: "#2e7d32" },
  userTypeText: { color: "#000" },
  checkboxContainer: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  checkboxText: { marginLeft: 8, color: "#555" },
  signupText: { fontSize: 14, color: "#555" },
  signupLink: { color: "#2e7d32", fontWeight: "bold" },
});
