// fcm.js - optional Push Notifications setup (requires Firebase Console VAPID key)
import { app } from "./firebase.js";
import { toast } from "./ui.js";

import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging.js";

export async function enablePushNotifications() {
  try{
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast("تم رفض الإشعارات.", "warn");
      return null;
    }

    const vapidKey = "PUT_YOUR_VAPID_KEY_HERE";
    const token = await getToken(messaging, { vapidKey });

    toast("تم تفعيل الإشعارات ✅", "success");
    return token;
  }catch(e){
    console.error(e);
    toast("تعذر تفعيل الإشعارات.", "error");
    return null;
  }
}

export function listenForegroundMessages(){
  try{
    const messaging = getMessaging(app);
    onMessage(messaging, (payload)=>{
      const title = payload?.notification?.title || "Pixology";
      const body = payload?.notification?.body || "إشعار جديد";
      toast(`${title}: ${body}`, "info", 3500);
    });
  }catch(e){}
}
