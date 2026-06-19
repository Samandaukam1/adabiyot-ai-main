import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { palette } from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Topilmadi" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Sahifa topilmadi</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Bosh sahifaga qaytish</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.bg,
    padding: 20,
  },
  title: { fontSize: 20, fontWeight: "600", color: palette.text },
  link: { marginTop: 16 },
  linkText: { color: palette.primary, fontSize: 15 },
});
