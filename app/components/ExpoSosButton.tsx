import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import React, { useRef, useState } from 'react';
import { Alert, Animated, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../../FirebaseConfig';

export default function ExpoSosButton() {
  const progress = useRef(new Animated.Value(0)).current;
  const [isHolding, setIsHolding] = useState(false);
  const [status, setStatus] = useState('Hold to trigger SOS');

  const sanitizePhone = (raw: string) => raw.replace(/[^0-9+]/g, '').trim();

  const fetchRandomEmergencyPhone = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) return null;
    const q = query(collection(db, 'emergency_contacts'), where('userId', '==', user.uid));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const list = snap.docs.map(d => d.data() as any);
    const idx = Math.floor(Math.random() * list.length);
    const raw = list[idx]?.phone || '';
    const phone = sanitizePhone(raw);
    return phone || null;
  };

  const saveAlert = async (phone: string | null) => {
    const user = auth.currentUser;
    if (!user) return;
    await addDoc(collection(db, 'alerts'), {
      student_uid: user.uid,
      student_name: user.displayName || user.email?.split('@')[0] || 'Student',
      title: 'Emergency Alert',
      description: 'Emergency SOS triggered by the student.',
      timestamp: serverTimestamp(),
      type: 'emergency',
      audience: 'student',
    });

    const guardianSnapshot = await getDocs(
      query(
        collection(db, 'guardian_requests'),
        where('student_uid', '==', user.uid),
        where('status', '==', 'accepted')
      )
    );

    const guardianPhones = guardianSnapshot.docs
      .map((item) => String(item.data().guardian_phone || '').replace(/\s/g, ''))
      .filter(Boolean);

    await Promise.all(
      guardianPhones.map((guardianPhone) =>
        addDoc(collection(db, 'alerts'), {
          source_student_uid: user.uid,
          student_name: user.displayName || user.email?.split('@')[0] || 'Student',
          title: 'Emergency Alert',
          description: 'Emergency alert triggered by the student.',
          timestamp: serverTimestamp(),
          type: 'emergency',
          audience: 'guardian',
          recipient_guardian_phone: guardianPhone,
        })
      )
    );

  };

  const makeCall = async (phone: string) => {
    if (Platform.OS === 'android') {
      return Linking.openURL(`tel:${phone}`);
    }

    return Linking.openURL(`telprompt:${phone}`);
  };

  const onLongPress = async () => {
    setIsHolding(false);
    setStatus('SOS triggered');

    const phone = await fetchRandomEmergencyPhone();
    if (!phone) {
      setStatus('SOS not sent — no contact');
      Alert.alert('No emergency contact found', 'Please add an emergency contact first.');
      return;
    }

    const saveAlertPromise = saveAlert(phone);

    try {
      await makeCall(phone);
      // don't show a success dialog — the dialer UI is sufficient
      setStatus('');
    } catch (err) {
      console.error('call error', err);
      setStatus('SOS saved, call failed');
      Alert.alert('SOS saved', `Alert saved but could not open dialer for ${phone}.`);
    }

    void saveAlertPromise.catch((err) => {
      console.error('SOS save error', err);
    });

    // reset animation
    setTimeout(() => progress.setValue(0), 500);
  };

  const onPressIn = () => {
    setIsHolding(true);
    setStatus('Hold for 3 seconds...');
    Animated.timing(progress, { toValue: 1, duration: 3000, useNativeDriver: false }).start();
  };

  const onPressOut = () => {
    if (isHolding) {
      setIsHolding(false);
      setStatus('SOS cancelled by user');
      Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();

      // Record cancellation in Firestore so guardians/students see the cancel event with time
      (async () => {
        try {
          const user = auth.currentUser;
          if (user) {
            await addDoc(collection(db, 'alerts'), {
              student_uid: user.uid,
              student_name: user.displayName || user.email?.split('@')[0] || 'Student',
              title: 'Alert Cancelled',
              description: 'Emergency alert cancelled by the student.',
              timestamp: serverTimestamp(),
              type: 'cancel',
              audience: 'student',
            });
          }
        } catch (err) {
          console.error('Failed to record SOS cancel:', err);
        }
      })();

      Alert.alert('SOS cancelled', 'Press and hold for 3 seconds to trigger SOS.');
    }
  };

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.ring,
          {
            transform: [
              {
                rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
              },
            ],
            opacity: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.3, 0.8, 0.3] }),
          },
        ]}
      />

      <TouchableOpacity
        style={[styles.button, isHolding && styles.buttonHold]}
        onPressIn={onPressIn}
        onLongPress={onLongPress}
        onPressOut={onPressOut}
        delayLongPress={3000}
        activeOpacity={0.8}
      >
        <Text style={styles.text}>SOS</Text>
      </TouchableOpacity>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', marginTop: 20 },
  ring: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 8, borderColor: 'rgba(255,82,82,0.4)', borderTopColor: 'rgba(255,82,82,1)' },
  button: { backgroundColor: '#FF5252', height: 100, width: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  buttonHold: { backgroundColor: '#D32F2F' },
  text: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  status: { marginTop: 12, color: '#555' },
});
