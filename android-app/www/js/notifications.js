// ── Milestone notifications (native only) ────────────────────────────────────
//
// Schedules local notifications so the phone alerts the user as they approach a
// fun upcoming milestone — works with no backend and fires even when the app is
// closed. Runs only inside the Capacitor native shell; on the plain website the
// Capacitor global is absent and every function below is a no-op.

(function () {
  const Cap = window.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const LN = Cap && Cap.Plugins && Cap.Plugins.LocalNotifications;

  // How many of the nearest upcoming milestones to keep scheduled at once.
  // Android won't reliably hold a huge backlog of far-future alarms, so we keep
  // a rolling window and refill it every time the app opens / resumes.
  const WINDOW = 16;
  // Stable channel for Android 8+.
  const CHANNEL_ID = 'milestones';

  let permissionAsked = false;

  async function ensurePermission() {
    if (!LN) return false;
    try {
      let perm = await LN.checkPermissions();
      if (perm.display !== 'granted' && !permissionAsked) {
        permissionAsked = true;
        perm = await LN.requestPermissions();
      }
      return perm.display === 'granted';
    } catch (e) {
      console.warn('[notifications] permission check failed', e);
      return false;
    }
  }

  async function ensureChannel() {
    if (!LN || !LN.createChannel) return;
    try {
      await LN.createChannel({
        id: CHANNEL_ID,
        name: 'Milestone reminders',
        description: 'Alerts as you approach a fun age milestone',
        importance: 4, // HIGH — heads-up notification
      });
    } catch (e) {
      // Not fatal: channels only exist on Android 8+.
    }
  }

  // Turn a milestone id string into a stable positive 32-bit integer, since the
  // plugin requires integer notification ids. A small suffix distinguishes the
  // "day before" reminder from the "on the day" alert for the same milestone.
  function hashId(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return Math.abs(h) % 2000000000;
  }

  function dayBeforeBody(label) {
    return `Tomorrow you reach ${label}. Get ready to celebrate! 🎉`;
  }
  function dayOfBody(label) {
    return `Today's the day — you've reached ${label}! 🎂`;
  }

  // Build the list of notifications to schedule from the upcoming milestones.
  // `milestones` is S.milestones: objects with { id, label, date } where date is
  // a Luxon DateTime.
  function buildSchedule(milestones) {
    const nowMs = Date.now();
    const upcoming = milestones
      .filter(m => m.date.toMillis() > nowMs)
      .sort((a, b) => a.date.toMillis() - b.date.toMillis())
      .slice(0, WINDOW);

    const out = [];
    for (const m of upcoming) {
      const at = m.date.toJSDate();
      const dayBefore = new Date(at.getTime() - 24 * 60 * 60 * 1000);

      // "Day before" reminder — only if it's still in the future.
      if (dayBefore.getTime() > nowMs) {
        out.push({
          id: hashId(m.id + '|pre'),
          channelId: CHANNEL_ID,
          title: 'Milestone approaching',
          body: dayBeforeBody(m.label),
          schedule: { at: dayBefore, allowWhileIdle: true },
        });
      }
      // "On the day" alert.
      out.push({
        id: hashId(m.id + '|day'),
        channelId: CHANNEL_ID,
        title: 'Milestone reached!',
        body: dayOfBody(m.label),
        schedule: { at, allowWhileIdle: true },
      });
    }
    return out;
  }

  // Public entry point: (re)build the rolling notification schedule.
  async function schedule(milestones) {
    if (!isNative || !LN || !Array.isArray(milestones) || !milestones.length) return;

    const granted = await ensurePermission();
    if (!granted) return;
    await ensureChannel();

    try {
      // Clear what we previously scheduled so the window stays clean.
      const pending = await LN.getPending();
      if (pending && pending.notifications && pending.notifications.length) {
        await LN.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }

      const notifications = buildSchedule(milestones);
      if (notifications.length) {
        await LN.schedule({ notifications });
        console.log(`[notifications] scheduled ${notifications.length} milestone alerts`);
      }
    } catch (e) {
      console.warn('[notifications] schedule failed', e);
    }
  }

  // Re-arm the schedule whenever the app returns to the foreground, so the
  // rolling window advances and past alerts are replaced with new ones.
  if (isNative && Cap.Plugins && Cap.Plugins.App) {
    Cap.Plugins.App.addListener('resume', () => {
      if (window.S && window.S.milestones) schedule(window.S.milestones);
    });
  }

  window.MilestoneNotifications = { schedule, isNative };
})();
