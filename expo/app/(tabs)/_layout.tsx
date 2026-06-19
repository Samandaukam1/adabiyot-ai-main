import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { BookOpen, Film, Home, MessageCircle, User } from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { palette } from "@/constants/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.textMuted,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
          height: Platform.OS === "ios" ? 88 : 70,
          paddingTop: 8,
        },
        tabBarBackground: () => (
          Platform.OS === "web" ? (
            <View style={[StyleSheet.absoluteFill, {
              backgroundColor: "rgba(248,245,240,0.98)",
              borderTopWidth: 1,
              borderTopColor: "rgba(0,0,0,0.06)",
            }]} />
          ) : (
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill}>
              <View style={[StyleSheet.absoluteFill, {
                backgroundColor: "rgba(248,245,240,0.88)",
                borderTopWidth: 1,
                borderTopColor: "rgba(0,0,0,0.06)",
              }]} />
            </BlurView>
          )
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Bosh sahifa",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabStyles.activeIcon : undefined}>
              <Home color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: "Reels",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabStyles.activeIcon : undefined}>
              <Film color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="tokcha"
        options={{
          title: "Tokcha",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabStyles.activeIcon : undefined}>
              <BookOpen color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="sozlab"
        options={{
          title: "So'zLab",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabStyles.activeIcon : undefined}>
              <MessageCircle color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? tabStyles.activeIcon : undefined}>
              <User color={color} size={22} strokeWidth={focused ? 2.5 : 2} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="maqolalar" options={{ href: null }} />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  activeIcon: {
    backgroundColor: "rgba(45,106,79,0.12)",
    borderRadius: 10,
    padding: 4,
    marginTop: -2,
  },
});
