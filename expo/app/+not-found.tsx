import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";
import { useTheme } from "@/providers/ThemeProvider";

export default function NotFoundScreen() {
  const { colors: c } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Topilmadi" }} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, padding: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: "600", color: c.text }}>Sahifa topilmadi</Text>
        <Link href="/" style={{ marginTop: 16 }}>
          <Text style={{ color: c.primary, fontSize: 15 }}>Bosh sahifaga qaytish</Text>
        </Link>
      </View>
    </>
  );
}
