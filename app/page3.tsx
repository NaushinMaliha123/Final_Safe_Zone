import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { commonStyles } from "../styles/commonStyles";
import { useTheme } from "../context/ThemeContext";

export default function Page3() {
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
            <Ionicons name="shield" size={80} color={colors.primary} />
          </View>
          <Text style={[commonStyles.feature, { color: colors.primary }]}>Safe Zone Protection</Text>
          <Text style={[commonStyles.desc, { color: colors.text }]}>
            Set up safe zones and get notified when you enter or leave designated areas.
          </Text>
        </View>

        <View style={commonStyles.footer}>
          <View style={commonStyles.dots}>
            <View style={[commonStyles.dot, { backgroundColor: colors.isDark ? "#444" : "#ccc" }]} />
            <View style={[commonStyles.dot, { backgroundColor: colors.primary }]} />
            <View style={[commonStyles.dot, { backgroundColor: colors.isDark ? "#444" : "#ccc" }]} />
          </View>
          <TouchableOpacity style={[commonStyles.button, { backgroundColor: colors.primary }]} onPress={() => router.push("./page4")}>
            <Text style={commonStyles.buttonText}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
