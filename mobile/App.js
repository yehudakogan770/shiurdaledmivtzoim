// SD Mivtzoim, the Android app. The whole site is one file kept inside the app, so nothing is
// loaded from sdmivtzoim.com (some filtered connections block websites but allow apps). The app
// only talks to the database. When the site is updated, the app quietly downloads the new file.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, Linking, StatusBar, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import { useKeepAwake } from "expo-keep-awake";
import * as FS from "expo-file-system/legacy";
import packed from "./assets/site/app.json";

const TEAL = "#106a7a";
const DIR = FS.documentDirectory + "site/";
const PAGE = DIR + "app.html";
const INFO = DIR + "app.json";
// Where a newer copy of the site may be found, tried in order (any one that answers is enough).
const SOURCES = [
  "https://sdmivtzoim.com/",
  "https://raw.githubusercontent.com/yehudakogan770/shiurdaledmivtzoim/gh-pages/",
  "https://cdn.jsdelivr.net/gh/yehudakogan770/shiurdaledmivtzoim@gh-pages/",
];
const CHECK_EVERY = 15 * 60 * 1000;
// A new version is only swapped in when nobody has touched the screen for this long.
const QUIET = 60 * 1000;

const readInfo = async () => {
  try {
    return JSON.parse(await FS.readAsStringAsync(INFO));
  } catch {
    return null;
  }
};
// Build ids from the site are code versions (not dates), so "newer" means "packed into the app later".
const packedAt = Number(packed.packedAt || 0);

/** Makes sure the phone has a copy of the site to show: the one packed into the app, unless a downloaded one is newer. */
async function prepare() {
  await FS.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
  const have = await readInfo();
  const page = await FS.getInfoAsync(PAGE);
  if (page.exists && have && (have.savedAt || 0) >= packedAt) return have.build;
  try {
    const asset = Asset.fromModule(require("./assets/site/app.html"));
    await asset.downloadAsync();
    await FS.deleteAsync(PAGE, { idempotent: true });
    await FS.copyAsync({ from: asset.localUri || asset.uri, to: PAGE });
    await FS.writeAsStringAsync(INFO, JSON.stringify({ build: packed.build, savedAt: packedAt }));
    return packed.build;
  } catch {
    // The packed copy couldn't be unpacked on this device: keep an older copy if there is one, else download one.
    if (page.exists && have) return have.build;
    if (await fetchUpdate("none")) return (await applyUpdate()) || null;
    return null;
  }
}

/** Looks for a newer copy; downloads it next to the current one. True when one is waiting. */
async function fetchUpdate(current) {
  for (const base of SOURCES) {
    try {
      const res = await fetch(`${base}app.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) continue;
      const info = await res.json();
      if (!info.build) continue;
      if (info.build === current) return false;
      const next = DIR + "next.html";
      const got = await FS.downloadAsync(`${base}app.html?b=${encodeURIComponent(info.build)}`, next);
      const file = await FS.getInfoAsync(next);
      // Only a whole, real copy is accepted: the right size, and marked as this build.
      const head = got.status === 200 && file.exists ? await FS.readAsStringAsync(next, { length: 2000, position: 0 }).catch(() => "") : "";
      if (!head.includes(`sdm-app-build" content="${info.build}"`) || (info.bytes && Math.abs(file.size - info.bytes) > 16)) {
        await FS.deleteAsync(next, { idempotent: true });
        continue;
      }
      await FS.writeAsStringAsync(DIR + "next.json", JSON.stringify({ build: info.build, savedAt: Date.now() }));
      return true;
    } catch {
      // This source is blocked or down: try the next one.
    }
  }
  return false;
}

async function applyUpdate() {
  const next = await FS.getInfoAsync(DIR + "next.html");
  if (!next.exists) return null;
  const info = await FS.readAsStringAsync(DIR + "next.json");
  await FS.deleteAsync(PAGE, { idempotent: true });
  await FS.moveAsync({ from: DIR + "next.html", to: PAGE });
  await FS.writeAsStringAsync(INFO, info);
  await FS.deleteAsync(DIR + "next.json", { idempotent: true });
  return JSON.parse(info).build;
}

export default function App() {
  useKeepAwake();
  const [build, setBuild] = useState(null);
  const web = useRef(null);
  const touched = useRef(Date.now());
  const current = useRef(null);

  const update = useCallback(async (now) => {
    if (!current.current) return;
    await fetchUpdate(current.current);
    if (!now && Date.now() - touched.current < QUIET) return;
    const applied = await applyUpdate().catch(() => null);
    if (applied) {
      current.current = applied;
      setBuild(applied);
    }
  }, []);

  useEffect(() => {
    const begin = async () => {
      const b = await prepare().catch(() => null);
      // A copy downloaded last time is put in place before anything shows.
      const applied = await applyUpdate().catch(() => null);
      if (!applied && !b) return setTimeout(begin, 5000); // No copy and no connection yet: try again shortly.
      current.current = applied || b;
      setBuild(current.current);
      update(false);
    };
    begin();
    const timer = setInterval(() => update(false), CHECK_EVERY);
    // Coming back to the app is a good moment to switch to a new version.
    const sub = AppState.addEventListener("change", (s) => s === "active" && update(true));
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [update]);

  // The back button goes back a page inside the site; on the first page it leaves the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      web.current?.injectJavaScript("window.ReactNativeWebView.postMessage(JSON.stringify({ back: !!(window.sdmBack && window.sdmBack()) })); true;");
      return true;
    });
    return () => sub.remove();
  }, []);

  if (!build) {
    return (
      <View style={[styles.fill, styles.center]}>
        <StatusBar backgroundColor={TEAL} barStyle="light-content" />
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }
  return (
    <View style={styles.fill} onTouchStart={() => (touched.current = Date.now())}>
      <StatusBar backgroundColor={TEAL} barStyle="light-content" />
      <WebView
        key={build}
        ref={web}
        source={{ uri: PAGE }}
        style={styles.web}
        originWhitelist={["*"]}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        domStorageEnabled
        javaScriptEnabled
        geolocationEnabled
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        overScrollMode="never"
        textZoom={100}
        onMessage={(e) => {
          try {
            if (JSON.parse(e.nativeEvent.data).back === false) BackHandler.exitApp();
          } catch {}
        }}
        // Links that leave the site (Google Maps, Cash App, email) open in their own apps.
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith("file://") || req.url.startsWith("about:")) return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: TEAL, paddingTop: StatusBar.currentHeight || 0 },
  center: { alignItems: "center", justifyContent: "center" },
  web: { flex: 1, backgroundColor: "#efedf0" },
});
