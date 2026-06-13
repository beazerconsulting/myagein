// Notifications disabled — no permission prompt will ever be shown.
window.MilestoneNotifications = {
  schedule: function () {},
  isNative: !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
};
