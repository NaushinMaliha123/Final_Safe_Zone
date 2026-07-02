import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { auth, db } from "../FirebaseConfig";

interface BottomNavProps {
  activeTab: 'Home' | 'Alerts' | 'Profile' | 'Helpline' | 'Chat';
  userType: 'Student' | 'Guardian';
  unreadChatCount?: number;
}

export default function BottomNav({ activeTab, userType, unreadChatCount }: BottomNavProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [localUnreadCount, setLocalUnreadCount] = useState(0);

  useEffect(() => {
    // If unreadChatCount is explicitly provided, use it
    if (unreadChatCount !== undefined) {
      setLocalUnreadCount(unreadChatCount);
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    // Listen to real-time unseen messages
    const qUnseen = query(
      collection(db, "messages"),
      where("receiverId", "==", user.uid),
      where("seen", "==", false)
    );

    const unsubscribe = onSnapshot(qUnseen, (snapshot) => {
      const uniqueChatIds = new Set<string>();
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.chatId) {
          uniqueChatIds.add(data.chatId);
        }
      });
      // The requirement says: "kotojon tumake message diche jeta ekhono tumi seen deo ni" (How many people have messaged you that you haven't seen yet)
      // This is exactly the count of unique sender/chatIds that have unseen messages.
      setLocalUnreadCount(uniqueChatIds.size);
    }, (error) => {
      console.error("Error listening to unseen messages in BottomNav:", error);
    });

    return () => unsubscribe();
  }, [unreadChatCount]);

  const handleNav = (route: string) => {
    // Role-specific routing logic
    if (route === "./DashboardPage") {
      router.replace(userType === 'Guardian' ? "/guardian/home" : "/student/home");
    } else if (route === "./Alerts") {
      router.replace(userType === 'Guardian' ? "/guardian/alerts" : "/student/alerts");
    } else if (route === "./Profile") {
      router.replace(userType === 'Guardian' ? "/guardian/profile" : "/student/profile");
    } else if (route === "./Helpline") {
      router.replace("/student/Helpline");
    } else if (route === "./Chat") {
      router.replace("/chat" as any);
    } else {
      router.replace(route as any);
    }
  };

  return (
    <View style={[styles.bottomNav, { backgroundColor: colors.bottomNavBg, borderTopColor: colors.bottomNavBorder, paddingBottom: insets.bottom, height: 60 + insets.bottom }]}>
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => handleNav("./DashboardPage")}
      >
        <MaterialIcons 
          name="home" 
          size={24} 
          color={activeTab === 'Home' ? colors.primary : colors.subText} 
        />
        <Text style={[styles.navText, { color: activeTab === 'Home' ? colors.primary : colors.subText }]}>Home</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => handleNav("./Alerts")}
      >
        <MaterialIcons 
          name={activeTab === 'Alerts' ? "notifications" : "notifications-none"} 
          size={24} 
          color={activeTab === 'Alerts' ? colors.primary : colors.subText} 
        />
        <Text style={[styles.navText, { color: activeTab === 'Alerts' ? colors.primary : colors.subText }]}>Alerts</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => handleNav("./Chat")}
      >
        <View style={{ position: 'relative' }}>
          <MaterialIcons 
            name={activeTab === 'Chat' ? "chat" : "chat-bubble-outline"} 
            size={24} 
            color={activeTab === 'Chat' ? colors.primary : colors.subText} 
          />
          {localUnreadCount > 0 && (
            <View style={[styles.badgeContainer, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText}>{localUnreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.navText, { color: activeTab === 'Chat' ? colors.primary : colors.subText }]}>Chat</Text>
      </TouchableOpacity>

      {userType === 'Student' && (
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => handleNav("./Helpline")}
        >
          <MaterialIcons 
            name="phone" 
            size={24} 
            color={activeTab === 'Helpline' ? colors.primary : colors.subText} 
          />
          <Text style={[styles.navText, { color: activeTab === 'Helpline' ? colors.primary : colors.subText }]}>Helpline</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => handleNav("./Profile")}
      >
        <MaterialIcons 
          name={activeTab === 'Profile' ? "person" : "person-outline"} 
          size={24} 
          color={activeTab === 'Profile' ? colors.primary : colors.subText} 
        />
        <Text style={[styles.navText, { color: activeTab === 'Profile' ? colors.primary : colors.subText }]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: { flexDirection: "row", height: 60, borderTopWidth: 1, borderTopColor: "#eee", backgroundColor: "#fff", justifyContent: "space-around", alignItems: "center" },
  navItem: { alignItems: "center", flex: 1 },
  navText: { fontSize: 12, color: "#ccc", marginTop: 4 },
  activeNavText: { color: "#4CAF50" },
  badgeContainer: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: '#FF5252',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#fff'
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
});
