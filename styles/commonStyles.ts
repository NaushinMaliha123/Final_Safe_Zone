// styles/commonStyles.ts
import { StyleSheet } from "react-native";

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff", // ছবির মতো সাদা ব্যাকগ্রাউন্ড
    justifyContent: "space-between",
  },
  headerBar: {
    height: 100,
    backgroundColor: "#4CAF50", // উপরের সবুজ বার
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 30, // Status bar content-centric padding
  },
  headerText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  headerTitle: {
    color: "#0a4f0b",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  circle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#E8F5E9", // হালকা সবুজ সার্কেল
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  feature: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#4CAF50",
    marginBottom: 10,
    textAlign: "center",
  },
  desc: {
    fontSize: 14,
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 70,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  footer: {
    paddingBottom: 20,
    alignItems: 'center',
  },
});
