import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { FONT } from "@/components/ui";

export interface PageCurlReaderTheme {
  paper: string;
  text: string;
  textSecondary: string;
  paperEdge: string;
}

interface PageCurlReaderProps {
  theme: PageCurlReaderTheme;
  [key: string]: unknown;
}

export default function PageCurlReader({ theme }: PageCurlReaderProps) {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.paper,
          borderColor: theme.paperEdge,
        },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>Barqaror o'qish rejimi</Text>
      <Text style={[styles.text, { color: theme.textSecondary }]}>
        Sahifa burish tajribasi vaqtincha o'chirilgan. O'qish uchun vertikal barqaror rejimdan foydalaning.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  title: {
    fontFamily: FONT.serif,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  text: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10,
  },
});
