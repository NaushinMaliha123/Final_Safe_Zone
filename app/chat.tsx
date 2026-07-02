import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import BottomNav from "../components/BottomNav";
import { useTheme } from "../context/ThemeContext";
import { auth, db } from "../FirebaseConfig";

interface Friend {
  uid: string;
  name: string;
  mobile: string;
  userType: 'Student' | 'Guardian';
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: any;
}

const { width: screenWidth } = Dimensions.get("window");

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { friendId, friendName } = params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<'Student' | 'Guardian' | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activeFriend, setActiveFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isInputFocused, setInputFocused] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isListReady, setListReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const isFirstLoad = useRef(true);

  // Map to hold last messages for each chatId
  const [lastMessages, setLastMessages] = useState<{ [chatId: string]: Message }>({});
  const [unseenCounts, setUnseenCounts] = useState<{ [chatId: string]: number }>({});

  const flatListRef = useRef<FlatList>(null);

  // Trigger haptic feedback
  const triggerHaptic = async (type: 'light' | 'success' | 'warning') => {
    try {
      if (type === 'light') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (type === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'warning') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch (e) {
      // Haptics not supported or web fallback
    }
  };

  // Generate a distinct avatar background color based on user name
  const getAvatarTheme = (name: string) => {
    const colors = [
      { bg: "#E0F2FE", text: "#0369A1" }, // Sky
      { bg: "#E0E7FF", text: "#3730A3" }, // Indigo
      { bg: "#F3E8FF", text: "#6B21A8" }, // Purple
      { bg: "#FFE4E6", text: "#9F1239" }, // Rose
      { bg: "#FEF3C7", text: "#92400E" }, // Amber
      { bg: "#E8F5E9", text: "#4CAF50" }, // App Green
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getMessageTimestamp = (m: any) => {
    if (!m.createdAt) return Date.now();
    if (m.createdAt.toDate) return m.createdAt.toDate().getTime();
    if (typeof m.createdAt === 'number') return m.createdAt;
    if (m.createdAt.seconds) return m.createdAt.seconds * 1000;
    return new Date(m.createdAt).getTime() || Date.now();
  };

  // 1. Fetch current user profile & set up friends list
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubRequests: (() => void) | null = null;
    let unsubLastMessages: (() => void) | null = null;

    const initChat = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const cachedRole = await AsyncStorage.getItem("user_role");
        if (cachedRole) {
          setUserRole(cachedRole as any);
        }

        // Try loading friends list from cache instantly
        const cachedFriends = await AsyncStorage.getItem(`cached_chat_friends_${user.uid}`);
        if (cachedFriends) {
          setFriends(JSON.parse(cachedFriends));
          setLoading(false);
        }

        // Try loading cached last messages instantly
        const cachedLastMsgs = await AsyncStorage.getItem(`cached_chat_last_messages_${user.uid}`);
        if (cachedLastMsgs) {
          setLastMessages(JSON.parse(cachedLastMsgs));
        }

        // Fetch Current User Details
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          setLoading(false);
          return;
        }

        const profile = { uid: user.uid, ...userDocSnap.data() } as any;
        setCurrentUserProfile(profile);

        // Fetch connected friends (guardians/students)
        const requestsQuery = profile.userType === "Student" 
          ? query(collection(db, "guardian_requests"), where("student_uid", "==", user.uid), where("status", "==", "accepted"))
          : query(collection(db, "guardian_requests"), where("guardian_phone", "==", profile.mobile), where("status", "==", "accepted"));

        // Listen to requests real-time
        unsubRequests = onSnapshot(requestsQuery, async (snapshot) => {
          const uidsToFetch: string[] = [];

          snapshot.docs.forEach((d) => {
            const data = d.data();
            const fUid = profile.userType === "Student" ? data.target_uid : data.student_uid;
            if (fUid && !uidsToFetch.includes(fUid)) {
              uidsToFetch.push(fUid);
            }
          });

          // Fetch user details for all friends in parallel
          const fetchPromises = uidsToFetch.map(async (fUid) => {
            try {
              const fDoc = await getDoc(doc(db, "users", fUid));
              if (fDoc.exists()) {
                const fData = fDoc.data();
                return {
                  uid: fUid,
                  name: fData.name || "User",
                  mobile: fData.mobile || "",
                  userType: fData.userType,
                } as Friend;
              }
            } catch (err) {
              console.error("Error fetching friend profile:", err);
            }
            return null;
          });

          const results = await Promise.all(fetchPromises);
          const friendList = results.filter((item): item is Friend => item !== null);

          setFriends(friendList);
          setLoading(false);

          // Update AsyncStorage cache with the fresh friends list
          await AsyncStorage.setItem(`cached_chat_friends_${user.uid}`, JSON.stringify(friendList));
        });

        // Set up real-time listener for last messages of all chats
        const messagesQuery = query(
          collection(db, "messages"),
          where("participants", "array-contains", user.uid)
        );

        unsubLastMessages = onSnapshot(messagesQuery, async (snapshot) => {
          const allMsgs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
          })) as Message[];

          const lastMsgMap: { [chatId: string]: Message } = {};
          allMsgs.forEach((m) => {
            const cid = m.chatId;
            if (!lastMsgMap[cid]) {
              lastMsgMap[cid] = m;
            } else {
              const timeCurrent = getMessageTimestamp(m);
              const timeExisting = getMessageTimestamp(lastMsgMap[cid]);
              if (timeCurrent > timeExisting) {
                lastMsgMap[cid] = m;
              }
            }
          });
          setLastMessages(lastMsgMap);
          await AsyncStorage.setItem(`cached_chat_last_messages_${user.uid}`, JSON.stringify(lastMsgMap));
        });

      } catch (e) {
        console.error("Error initializing chat list:", e);
        setLoading(false);
      }
    };

    initChat();

    return () => {
      if (unsubRequests) unsubRequests();
      if (unsubLastMessages) unsubLastMessages();
    };
  }, []);

  // Keyboard show/hide listener to adjust input container padding
  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // 2. Check if redirected with friend parameters
  useEffect(() => {
    if (friendId && friendName) {
      isFirstLoad.current = true;
      const activeRole = currentUserProfile?.userType || userRole;
      setActiveFriend({
        uid: friendId as string,
        name: friendName as string,
        mobile: "",
        userType: activeRole === "Student" ? "Guardian" : "Student",
      });
    }
  }, [friendId, friendName, currentUserProfile, userRole]);

  // 3. Listen to messages when activeFriend changes
  useEffect(() => {
    if (!activeFriend || !currentUserProfile) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    const user = auth.currentUser;
    if (!user) return;

    const chatId = [user.uid, activeFriend.uid].sort().join("_");
    const q = query(collection(db, "messages"), where("chatId", "==", chatId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];

      // Sort locally by timestamp
      msgs.sort((a, b) => {
        const timeA = getMessageTimestamp(a);
        const timeB = getMessageTimestamp(b);
        return timeA - timeB;
      });

      setMessages(msgs);
      setLoadingMessages(false);

      // Auto scroll to end and reveal the list afterwards to prevent flash of top messages
      if (msgs.length === 0) {
        setListReady(true);
      } else {
        setTimeout(() => {
          if (isFirstLoad.current) {
            flatListRef.current?.scrollToEnd({ animated: false });
            isFirstLoad.current = false;
            setListReady(true);
          } else {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }, 100);
      }
    }, (error) => {
      console.error("Error listening to messages:", error);
      setLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [activeFriend, currentUserProfile]);

  // 3b. Listen to all unseen messages for the current user to show badges
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const qUnseen = query(
      collection(db, "messages"),
      where("receiverId", "==", user.uid),
      where("seen", "==", false)
    );

    const unsubscribe = onSnapshot(qUnseen, (snapshot) => {
      const counts: { [chatId: string]: number } = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const chatId = data.chatId;
        counts[chatId] = (counts[chatId] || 0) + 1;
      });
      setUnseenCounts(counts);
    }, (error) => {
      console.error("Error listening to unseen messages:", error);
    });

    return () => unsubscribe();
  }, [currentUserProfile]);

  // 3c. Mark messages as seen when entering a chat conversation
  useEffect(() => {
    if (!activeFriend || !currentUserProfile) return;
    const user = auth.currentUser;
    if (!user) return;

    const chatId = [user.uid, activeFriend.uid].sort().join("_");
    const qUnseen = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      where("receiverId", "==", user.uid),
      where("seen", "==", false)
    );

    // Initial check
    getDocs(qUnseen).then((snap) => {
      snap.forEach((docSnap) => {
        updateDoc(doc(db, "messages", docSnap.id), { seen: true });
      });
    }).catch(err => console.error("Error marking initial messages as seen:", err));

    // Also mark incoming ones in real-time if we are inside the chat
    const unsubscribe = onSnapshot(qUnseen, (snapshot) => {
      snapshot.docs.forEach((docSnap) => {
        updateDoc(doc(db, "messages", docSnap.id), { seen: true });
      });
    });

    return () => unsubscribe();
  }, [activeFriend, currentUserProfile]);

  // 4. Send message handler
  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeFriend || !currentUserProfile) return;

    const user = auth.currentUser;
    if (!user) return;

    const messageText = inputText.trim();
    setInputText("");

    const chatId = [user.uid, activeFriend.uid].sort().join("_");

    try {
      addDoc(collection(db, "messages"), {
        chatId: chatId,
        senderId: user.uid,
        receiverId: activeFriend.uid,
        text: messageText,
        createdAt: serverTimestamp(),
        participants: [user.uid, activeFriend.uid],
        seen: false
      });

      // Scroll immediately for responsive UI
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } catch (error) {
      console.error("Failed to send message:", error);
      triggerHaptic('warning');
      alert("Failed to send message. Please try again.");
    }
  };

  // Select a friend and slide in the chat conversation screen
  const handleFriendSelect = (item: Friend) => {
    isFirstLoad.current = true;
    setListReady(false);
    setActiveFriend(item);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 45,
      friction: 8.5,
      useNativeDriver: true,
    }).start();
  };

  // Back from chat conversation view to friend list view with slide out animation
  const handleBack = () => {
    triggerHaptic('light');
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setActiveFriend(null);
      router.setParams({ friendId: undefined, friendName: undefined } as any);
    });
  };

  // Helper to robustly parse Firestore, JSON cached, string or null timestamps into Date
  const parseDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000);
    }
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    const parsed = new Date(timestamp);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  // Format message bubble timestamp (shows only time, e.g. 06:30 PM)
  const formatMessageTime = (firebaseTimestamp: any) => {
    const date = parseDate(firebaseTimestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format inbox last message timestamp (e.g. 06:30 PM, Yesterday, or Jul 1)
  const formatLastMessageTime = (firebaseTimestamp: any) => {
    const date = parseDate(firebaseTimestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Get exact date string to check if message dates match
  const getDateString = (firebaseTimestamp: any) => {
    const date = parseDate(firebaseTimestamp);
    return date.toDateString();
  };

  // Formatted header date separator (e.g. "Today", "Yesterday", "June 30")
  const getDateLabel = (firebaseTimestamp: any) => {
    const date = parseDate(firebaseTimestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    }
  };

  const getChatId = (friendUid: string) => {
    const user = auth.currentUser;
    if (!user) return "";
    return [user.uid, friendUid].sort().join("_");
  };

  // Filtered and sorted friends list based on search bar query & latest message timestamp
  const filteredFriends = friends
    .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const chatIdA = getChatId(a.uid);
      const chatIdB = getChatId(b.uid);
      const msgA = lastMessages[chatIdA];
      const msgB = lastMessages[chatIdB];

      const timeA = msgA ? getMessageTimestamp(msgA) : 0;
      const timeB = msgB ? getMessageTimestamp(msgB) : 0;

      // Sort strictly by latest message timestamp (descending order)
      // This ensures that whoever sent the latest message is always at the very top
      if (timeA !== timeB) {
        return timeB - timeA;
      }

      // Fallback: if neither has messages, sort alphabetically/by name
      return a.name.localeCompare(b.name);
    });



  // --- Render Conversation Screen ---
  const renderConversationScreen = () => {
    if (!activeFriend) return null;
    const avatarTheme = getAvatarTheme(activeFriend.name);
    return (
      <Animated.View 
        style={[
          StyleSheet.absoluteFill,
          { 
            backgroundColor: colors.background, 
            transform: [{ translateX: slideAnim }],
            zIndex: 1000,
          }
        ]}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background, flex: 1 }]}>
          <StatusBar barStyle={colors.isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
          
          {/* Chat Header */}
          <View style={[styles.chatHeader, { backgroundColor: colors.cardBg, borderBottomColor: colors.isDark ? "#2c2c2c" : "#CBD5E1", borderTopWidth: 3, borderTopColor: colors.primary }]}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <MaterialIcons name="arrow-back-ios" size={20} color={colors.primary} />
            </TouchableOpacity>
            <View style={[styles.headerAvatar, { backgroundColor: colors.isDark ? colors.background : avatarTheme.bg }]}>
              <Text style={[styles.avatarText, { color: colors.isDark ? colors.textDark : avatarTheme.text }]}>
                {activeFriend.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.headerName, { color: colors.textDark }]} numberOfLines={1}>{activeFriend.name}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerIconButton} onPress={() => triggerHaptic('light')}>
                <MaterialIcons name="info-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Message Workspace */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            {loadingMessages ? (
              <View style={[styles.centerMessages, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                style={{ opacity: isListReady ? 1 : 0 }}
                contentContainerStyle={[styles.messageList, { backgroundColor: colors.background }]}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                renderItem={({ item, index }) => {
                  const isCurrentUser = item.senderId === auth.currentUser?.uid;
                  const showDateSeparator = index === 0 || (
                    messages[index - 1] && 
                    getDateString(messages[index - 1].createdAt) !== getDateString(item.createdAt)
                  );

                  return (
                    <View style={styles.messageRow}>
                      {showDateSeparator && (
                        <View style={styles.dateSeparator}>
                          <Text style={[styles.dateSeparatorText, { backgroundColor: colors.inputBg, color: colors.subText }]}>{getDateLabel(item.createdAt)}</Text>
                        </View>
                      )}
                      <View style={[styles.messageBubbleContainer, isCurrentUser ? styles.bubbleRight : styles.bubbleLeft]}>
                        <View style={[styles.bubble, isCurrentUser ? styles.senderBubble : [styles.receiverBubble, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]]}>
                          <Text style={isCurrentUser ? styles.senderText : [styles.receiverText, { color: colors.textDark }]}>{item.text}</Text>
                          <View style={styles.timeContainer}>
                            <Text style={[styles.timestamp, isCurrentUser ? styles.senderTimestamp : [styles.receiverTimestamp, { color: colors.subText }]]}>
                              {formatMessageTime(item.createdAt)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={() => null}
              />
            )}

            {/* Bottom Send Input Bar */}
            <View style={[
              styles.inputContainer, 
              { 
                backgroundColor: colors.cardBg, 
                borderTopColor: colors.cardBorder,
                paddingBottom: isKeyboardVisible ? 6 : Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 10),
                paddingTop: isKeyboardVisible ? 6 : 10
              }
            ]}>
              <TextInput
                style={[
                  styles.textInput, 
                  { 
                    backgroundColor: colors.inputBg, 
                    color: colors.textDark,
                    borderWidth: 1,
                    borderColor: isInputFocused 
                      ? colors.primary 
                      : (colors.isDark ? colors.cardBorder : "#E2E8F0")
                  }
                ]}
                placeholder="Type message..."
                placeholderTextColor={colors.placeholderText}
                value={inputText}
                onChangeText={setInputText}
                multiline
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
              <TouchableOpacity 
                style={styles.sendButton} 
                onPress={() => {
                  triggerHaptic('success');
                  handleSendMessage();
                }}
                disabled={!inputText.trim()}
              >
                <MaterialIcons 
                  name="send" 
                  size={24} 
                  color={inputText.trim() ? colors.primary : colors.placeholderText} 
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Animated.View>
    );
  };

  const totalUnreadChats = Object.keys(unseenCounts).filter(cid => unseenCounts[cid] > 0).length;

  // --- Render Friend List (Chat List) Screen ---
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      {/* Chats Screen Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <View>
          <Text style={styles.title}>Messages</Text>
          <View style={styles.subtitlePill}>
            <Text style={styles.subtitlePillText}>SafeZone</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerRightButton} onPress={() => triggerHaptic('light')}>
          <MaterialIcons name="mark-chat-read" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Friend Bar */}
      <View style={[styles.searchBarContainer, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
        <MaterialIcons name="search" size={20} color={colors.subText} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchBar, { color: colors.textDark }]}
          placeholder="Search"
          placeholderTextColor={colors.placeholderText}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity 
            onPress={() => {
              triggerHaptic('light');
              setSearchQuery("");
            }} 
            style={styles.clearSearchIcon}
          >
            <MaterialIcons name="close" size={18} color={colors.subText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Friends Cards List */}
      {totalUnreadChats > 0 && (
        <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
          <View style={[styles.sectionAccentBar, { backgroundColor: colors.primary }]} />
          <View style={[styles.sectionBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.sectionBadgeText}>{totalUnreadChats} unread</Text>
          </View>
        </View>
      )}

      {/* Friends Cards List */}
      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={[styles.friendsList, { backgroundColor: colors.background }]}
        renderItem={({ item }) => {
          const chatId = getChatId(item.uid);
          const lastMsg = lastMessages[chatId];
          const hasLastMsg = !!lastMsg;
          const isSenderLast = lastMsg?.senderId === auth.currentUser?.uid;
          const avatarTheme = getAvatarTheme(item.name);
          const unreadCount = unseenCounts[chatId] || 0;
          const isUnread = unreadCount > 0;

          return (
            <TouchableOpacity 
              style={[
                styles.friendCard, 
                { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                isUnread && { borderWidth: 1.5, borderColor: colors.primary }
              ]} 
              onPress={() => {
                triggerHaptic('light');
                handleFriendSelect(item);
              }}
            >
              <View style={[styles.avatarLarge, { backgroundColor: colors.isDark ? colors.background : avatarTheme.bg }]}>
                <Text style={[styles.avatarLargeText, { color: colors.isDark ? colors.textDark : avatarTheme.text }]}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.friendInfo}>
                <View style={styles.friendHeader}>
                  <Text style={[
                    styles.friendName, 
                    { color: colors.textDark },
                    isUnread && { fontWeight: "900" }
                  ]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {isUnread && (
                    <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                  )}
                </View>
                {hasLastMsg ? (
                  <View style={styles.lastMessageRow}>
                    <Text 
                      style={[
                        styles.lastMessageText, 
                        isUnread ? { color: colors.textDark, fontWeight: "800" } : { color: colors.text }
                      ]} 
                      numberOfLines={1}
                    >
                      {isSenderLast ? "You: " : `${item.name.split(" ")[0]}: `}{lastMsg.text}
                    </Text>
                    <Text style={[
                      styles.friendTime, 
                      isUnread ? { color: colors.primary, fontWeight: "700" } : { color: colors.subText }
                    ]}>
                      {formatLastMessageTime(lastMsg.createdAt)}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.noMessageText, { color: colors.subText }]} numberOfLines={1}>
                    Tap to start chatting!
                  </Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.subText} style={styles.chevron} />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
            ) : (
              <>
                <View style={[styles.emptyIconContainer, { backgroundColor: colors.isDark ? colors.cardBg : "#F1F5F9" }]}>
                  <MaterialIcons name="chat-bubble-outline" size={48} color={colors.subText} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.textDark }]}>No conversations yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.subText }]}>
                  {(currentUserProfile?.userType || userRole) === "Student" 
                    ? "Add guardians from the Home screen to connect and chat with them safely." 
                    : "Active connections will show up here once students add you as their safety guardian."}
                </Text>
              </>
            )}
          </View>
        )}
      />

      {(currentUserProfile || userRole) && (
        <BottomNav activeTab="Chat" userType={currentUserProfile?.userType || userRole} unreadChatCount={totalUnreadChats} />
      )}

      {renderConversationScreen()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  loadingText: { marginTop: 12, fontSize: 15, color: "#64748B", fontWeight: "500" },
  header: { 
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24, 
    paddingTop: 18, 
    paddingBottom: 20, 
    backgroundColor: "#4CAF50",
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionAccentBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
    marginRight: 8,
    backgroundColor: '#4CAF50',
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    flex: 1,
  },
  sectionBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sectionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  title: { fontSize: 26, fontWeight: "800", color: "#ffffff", letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: "#ffffff", fontWeight: "700", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  subtitlePill: {
    marginTop: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  subtitlePillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerRightButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchBarContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#ffffff", 
    marginHorizontal: 20, 
    marginTop: 14, 
    marginBottom: 6, 
    paddingHorizontal: 16, 
    height: 44, 
    borderRadius: 22, 
    borderWidth: 1, 
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  searchIcon: { marginRight: 10 },
  clearSearchIcon: { padding: 4 },
  searchBar: { flex: 1, height: "100%", fontSize: 15, color: "#0F172A", fontWeight: "500" },
  friendsList: { padding: 20, paddingBottom: 100 },
  friendCard: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#ffffff", 
    borderRadius: 18, 
    padding: 16, 
    marginBottom: 12, 
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.04, 
    shadowRadius: 8,
    elevation: 1 
  },
  avatarLarge: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", position: "relative" },
  avatarLargeText: { fontSize: 18, fontWeight: "700" },
  onlineBadge: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#4CAF50", position: "absolute", bottom: -1, right: -1, borderWidth: 2.5, borderColor: "#ffffff" },
  friendInfo: { flex: 1, marginLeft: 16 },
  friendHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  friendName: { fontSize: 16, fontWeight: "700", color: "#0F172A", flex: 1, marginRight: 8 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  friendTime: { fontSize: 11, color: "#94A3B8", fontWeight: "500", marginLeft: 8 },
  lastMessageRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 5 },
  lastMessageText: { fontSize: 13, color: "#475569", fontWeight: "500", flex: 1, marginRight: 8 },
  noMessageText: { fontSize: 13, color: "#94A3B8", marginTop: 5, fontStyle: "italic" },
  chevron: { marginLeft: 6 },
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 80, paddingHorizontal: 32 },
  emptyIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  emptySubtitle: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 8, lineHeight: 20 },

  // Conversation styles
  chatHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#ffffff", // minimal white header
    paddingVertical: 12, 
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3
  },
  backButton: { padding: 8, marginRight: 4 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", position: "relative" },
  avatarText: { fontSize: 16, fontWeight: "700" },
  onlineBadgeSmall: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: "#4CAF50", position: "absolute", bottom: -1, right: -1, borderWidth: 2, borderColor: "#ffffff" },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerName: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  activeStatusRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  headerStatus: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  headerIconButton: { padding: 8 },
  centerMessages: { flex: 1, justifyContent: "center", alignItems: "center" },
  messageList: { paddingHorizontal: 16, paddingVertical: 20 },
  messageRow: { width: "100%" },
  dateSeparator: { 
    alignItems: "center", 
    justifyContent: "center", 
    marginVertical: 16 
  },
  dateSeparatorText: { 
    fontSize: 11, 
    color: "#64748B", 
    fontWeight: "700",
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: "hidden"
  },
  messageBubbleContainer: { marginBottom: 12, maxWidth: "78%" },
  bubbleRight: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleLeft: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { 
    borderRadius: 18, 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    elevation: 0.5, 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.03, 
    shadowRadius: 1 
  },
  senderBubble: { 
    backgroundColor: "#4CAF50", // Global Green
    borderBottomRightRadius: 4,
  },
  receiverBubble: { 
    backgroundColor: "#ffffff", 
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderBottomLeftRadius: 4,
  },
  senderText: { color: "#ffffff", fontSize: 15, lineHeight: 21, fontWeight: "500" },
  receiverText: { color: "#0F172A", fontSize: 15, lineHeight: 21, fontWeight: "500" },
  timeContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "flex-end", 
    marginTop: 4,
    alignSelf: "flex-end"
  },
  timestamp: { fontSize: 9, fontWeight: "500" },
  senderTimestamp: { color: "rgba(255, 255, 255, 0.75)" },
  receiverTimestamp: { color: "#94A3B8" },
  emptyChatContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 120, paddingHorizontal: 32 },
  emptyChatIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16
  },
  emptyChatTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  emptyChatText: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 6, lineHeight: 18 },
  inputContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#ffffff", 
    paddingHorizontal: 16, 
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: 1, 
    borderTopColor: "#F1F5F9",
  },
  textInput: { 
    flex: 1, 
    backgroundColor: "#F1F5F9", 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    fontSize: 15, 
    color: "#0F172A", 
    fontWeight: "500",
    maxHeight: 100, 
    minHeight: 38 
  },
  sendButton: { 
    justifyContent: "center", 
    alignItems: "center", 
    marginLeft: 12,
    padding: 4
  }
});
