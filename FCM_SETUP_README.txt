# Push Notifications (FCM) - Setup
هذه الملفات جاهزة كأساس لإضافة Push Notifications على المتصفح/الموبايل.

## مهم جدًا
Push Notifications تحتاج إعداد من Firebase Console:
- إنشاء Web Push Certificate (VAPID key)
- تفعيل Cloud Messaging
- إضافة firebase-messaging-sw.js على جذر الاستضافة
- طلب permission من المستخدم

## الملفات المضافة
- public/firebase-messaging-sw.js (Service Worker)
- fcm.js (طلب صلاحية + الحصول على token)

## كيف تشغلها؟
1) Firebase Console → Project Settings → Cloud Messaging
   خذ الـ VAPID Key (Web Push certificates)
2) ضع الـ VAPID key داخل fcm.js
3) نضيف زر "تفعيل الإشعارات" في my-profile (ممكن أضيفه لك بعدين)
