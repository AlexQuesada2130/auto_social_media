// Registro para notificaciones push.
//
// En iOS esto funciona dentro de Expo Go usando las credenciales de Expo. En
// Android dejó de funcionar en el SDK 53 y haría falta un development build:
// por eso aquí se comprueba la plataforma en vez de dar por hecho que va.

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

// Con la app abierta, que la notificación se vea igual.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId;

/**
 * Pide permiso y devuelve el token de Expo, o null con el motivo.
 * Nunca lanza: que falle el push no debe impedir usar la app.
 */
export async function registrarParaPush() {
  if (!Device.isDevice) {
    return { token: null, motivo: "el simulador no recibe push" };
  }
  if (Platform.OS === "android" && Constants.appOwnership === "expo") {
    return { token: null, motivo: "Expo Go en Android no admite push desde el SDK 53" };
  }
  if (!PROJECT_ID) {
    return { token: null, motivo: "falta el projectId en app.json" };
  }

  try {
    const { status: actual } = await Notifications.getPermissionsAsync();
    let status = actual;
    if (status !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") {
      return { token: null, motivo: "no diste permiso de notificaciones" };
    }

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    return { token: data, motivo: null };
  } catch (e) {
    return { token: null, motivo: e.message };
  }
}
