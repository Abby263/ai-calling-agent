import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

type Screen = "home" | "filters" | "preview" | "progress" | "results" | "saved";

const screens: { key: Screen; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "filters", label: "Filters" },
  { key: "preview", label: "Preview" },
  { key: "progress", label: "Calls" },
  { key: "results", label: "Results" },
  { key: "saved", label: "Saved" }
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [request, setRequest] = useState("Find happy hours near me and ask if they have vegan food.");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Voice Concierge</Text>
        <Text style={styles.subtitle}>Mobile shell for the shared API flow</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {screens.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setScreen(item.key)}
            style={[styles.tab, screen === item.key && styles.tabActive]}
          >
            <Text style={[styles.tabText, screen === item.key && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.body}>
        {screen === "home" ? (
          <View style={styles.panel}>
            <Text style={styles.heading}>What would you like me to find out?</Text>
            <TextInput
              value={request}
              onChangeText={setRequest}
              multiline
              style={styles.textarea}
              placeholder="Ask for nearby businesses, call questions, and preferences"
            />
            <Pressable style={styles.primary} onPress={() => setScreen("filters")}>
              <Text style={styles.primaryText}>Continue</Text>
            </Pressable>
          </View>
        ) : (
          <ScreenStub screen={screen} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ScreenStub({ screen }: { screen: Screen }) {
  const copy: Record<Screen, string> = {
    home: "",
    filters: "Location permission, distance, cuisine, rating, open-now, max calls, and dietary controls.",
    preview: "Restaurant preview with approve, edit questions, max calls, and do-not-call controls.",
    progress: "Live call status timeline with cancel controls and transcript availability.",
    results: "Final summary, comparison table, recommendations, uncertainty, and export actions.",
    saved: "Search request history and task deletion."
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>{screen[0].toUpperCase() + screen.slice(1)}</Text>
      <Text style={styles.copy}>{copy[screen]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef2f7"
  },
  header: {
    padding: 20,
    gap: 4
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827"
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b"
  },
  tabs: {
    maxHeight: 54,
    paddingHorizontal: 12
  },
  tab: {
    height: 38,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    marginHorizontal: 4
  },
  tabActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb"
  },
  tabText: {
    color: "#334155",
    fontWeight: "600"
  },
  tabTextActive: {
    color: "#fff"
  },
  body: {
    padding: 16
  },
  panel: {
    gap: 14,
    padding: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0"
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: "#111827"
  },
  copy: {
    color: "#475569",
    lineHeight: 22
  },
  textarea: {
    minHeight: 140,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 12,
    textAlignVertical: "top",
    color: "#111827"
  },
  primary: {
    height: 46,
    borderRadius: 6,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center"
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700"
  }
});

