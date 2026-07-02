import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { commonStyles } from "../styles/commonStyles";
import { useTheme } from "../context/ThemeContext";

export default function Page4() {
  const router = useRouter(); 
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  return (
    <ScrollView 
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
      }
    >
      <View style={[commonStyles.container, { backgroundColor: colors.background }]}>
        <View style={[commonStyles.headerBar, { backgroundColor: colors.headerBg }]}>
          <Text style={[commonStyles.headerText, { color: colors.headerText }]}>Smart SafeZone</Text>
        </View>

        <View style={commonStyles.content}>
          <View style={[commonStyles.circle, { backgroundColor: colors.isDark ? colors.cardBg : "#E8F5E9" }]}>
            <Ionicons name="alert-circle" size={80} color={colors.primary} />
          </View>
          <Text style={[commonStyles.feature, { color: colors.primary }]}>Emergency SOS</Text>
          <Text style={[commonStyles.desc, { color: colors.text }]}>
            Quick access to emergency alerts that instantly notify your trusted contacts with your location.
          </Text>
        </View>

        <View style={commonStyles.footer}>
          <View style={commonStyles.dots}>
            <View style={[commonStyles.dot, { backgroundColor: colors.isDark ? "#444" : "#ccc" }]} />
            <View style={[commonStyles.dot, { backgroundColor: colors.isDark ? "#444" : "#ccc" }]} />
            <View style={[commonStyles.dot, { backgroundColor: colors.primary }]} />
          </View>
          <TouchableOpacity style={[commonStyles.button, { backgroundColor: colors.primary }]} onPress={() => router.push("./login")}>
            <Text style={commonStyles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

      