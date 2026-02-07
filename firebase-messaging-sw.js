// firebase-messaging-sw.js
// Place this file at the ROOT of your hosting (same level as index.html)
// Requires Firebase Cloud Messaging setup.

importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

// ✅ Use same config as firebase.js (copy/paste)
firebase.initializeApp({
  // TODO: paste your firebaseConfig here
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || "Pixology";
  const options = {
    body: payload?.notification?.body || "إشعار جديد",
    icon: "icon-192.png",
  };
  self.registration.showNotification(title, options);
});
