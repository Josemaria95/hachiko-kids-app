import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleMondaySummaryNotification(
  mascotName: string,
): Promise<void> {
  await cancelSummaryNotifications();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Resumen semanal listo",
      body: `El resumen de ${mascotName} está listo. ¡Mira cómo le fue esta semana!`,
    },
    trigger: {
      type: SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2,
      hour: 10,
      minute: 0,
    },
  });
}

export async function cancelSummaryNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    await Notifications.cancelScheduledNotificationAsync(notif.identifier);
  }
}
