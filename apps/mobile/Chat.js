import { useRef, useState } from "react";
import {
  ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";

// El puente corre en el Mac: misma máquina que la API, puerto 3200. Se puede
// cambiar desde la propia pantalla cuando la red cambie.
function puenteDefecto() {
  const api = Constants.expoConfig?.extra?.apiUrl || "";
  const m = api.match(/^https?:\/\/([^:/]+)/);
  return m ? `http://${m[1]}:3200` : "";
}

const vibrar = (ok = true) => {
  if (Platform.OS !== "ios") return;
  Haptics.notificationAsync(
    ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
  ).catch(() => {});
};

export default function Chat({ c, s, m, insets, token }) {
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState(puenteDefecto());
  const [ajustes, setAjustes] = useState(false);
  const scroll = useRef(null);

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || pensando) return;

    const conmigo = [...mensajes, { de: "yo", texto: limpio }];
    setMensajes(conmigo);
    setTexto("");
    setPensando(true);
    setError("");
    Keyboard.dismiss();

    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mensajes: conmigo }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error || `El puente respondió ${res.status}`);
      setMensajes([...conmigo, { de: "claude", texto: datos.texto }]);
      vibrar(true);
    } catch (e) {
      // El fallo típico es el Mac apagado, el puente parado, u otra red.
      setError(
        e.message === "Network request failed"
          ? "No llego al puente. ¿Está el Mac encendido con puente.py corriendo, y estás en la misma red?"
          : e.message,
      );
      vibrar(false);
    }
    setPensando(false);
  }

  async function copiar(t) {
    await Clipboard.setStringAsync(t);
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top + m.esc(104)}
    >
      <ScrollView
        ref={scroll}
        contentContainerStyle={s.chatLista}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
      >
        {mensajes.length === 0 && !ajustes ? (
          <View style={s.vacio}>
            <Text style={s.vacioTitulo}>Habla del borrador</Text>
            <Text style={s.vacioTexto}>
              Pega un post y pide que lo acorte, que le cambie el gancho o que te
              diga qué sobra. Va contra el Claude de tu Mac, así que no cuesta nada.
            </Text>
          </View>
        ) : null}

        {mensajes.map((msg, i) => (
          <Pressable
            key={i} onLongPress={() => copiar(msg.texto)} delayLongPress={300}
            style={[s.burbuja, msg.de === "yo" ? s.burbujaMia : s.burbujaSuya]}
            accessibilityHint="Mantén pulsado para copiar"
          >
            <Text selectable style={msg.de === "yo" ? s.burbujaMiaTexto : s.burbujaSuyaTexto}>
              {msg.texto}
            </Text>
          </Pressable>
        ))}

        {pensando ? (
          <View style={[s.burbuja, s.burbujaSuya, { flexDirection: "row", gap: m.e.s, alignItems: "center" }]}>
            <ActivityIndicator size="small" color={c.suave} />
            <Text style={s.burbujaSuyaTexto}>Pensando…</Text>
          </View>
        ) : null}

        {error ? <Text style={s.error}>{error}</Text> : null}

        {ajustes ? (
          <View style={s.echar}>
            <Text style={s.echarLabel}>DIRECCIÓN DEL PUENTE</Text>
            <TextInput
              style={s.campo} value={url} onChangeText={setUrl}
              autoCapitalize="none" autoCorrect={false} keyboardType="url"
              placeholder="http://192.168.1.29:3200" placeholderTextColor={c.tenue}
              accessibilityLabel="Dirección del puente"
            />
            <Text style={s.vacioTexto}>
              La que imprime puente.py al arrancar. Cambia si cambias de red.
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={s.chatPie}>
        <Pressable
          onPress={() => setAjustes((a) => !a)} style={s.boton}
          accessibilityLabel={ajustes ? "Cerrar ajustes" : "Ajustes del puente"}
        >
          <Text style={s.botonTexto}>{ajustes ? "Listo" : "Ajustes"}</Text>
        </Pressable>
        <TextInput
          style={[s.campo, { flex: 1, maxHeight: m.esc(120) }]}
          value={texto} onChangeText={setTexto} multiline
          placeholder="Escribe aquí" placeholderTextColor={c.tenue}
          accessibilityLabel="Mensaje"
        />
        <Pressable
          onPress={enviar} disabled={pensando || !texto.trim()}
          style={[s.boton, s.botonPrimario, (pensando || !texto.trim()) && s.botonApagado]}
          accessibilityRole="button"
        >
          <Text style={s.botonPrimarioTexto}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
